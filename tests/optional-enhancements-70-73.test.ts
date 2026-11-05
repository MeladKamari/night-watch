import {
  ENABLED_SOURCE_COUNT,
  ENTROPY_EXPERIMENT_DISCLAIMER,
  ENTROPY_EXPERIMENTS_REVISION,
  ExperimentConsentError,
  FIRST_PARTY_SERVER_INTEGRATION_DESIGN,
  SERVER_INTEGRATION_DESIGN_REVISION,
  SOURCE_MANIFEST_REVISION,
  SOURCE_METADATA_REGISTRY_REVISION,
  browserSdkExposesServerClient,
  createBuiltinSources,
  createEntropyExperimentHarness,
  getSourceMetadata,
  getSourceMetadataRegistry,
  hashComponents,
  load,
  sourceMetadataRegistryToJson,
} from '@night-watch/browser-sdk'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

describe('step 70 — entropy experiment harness', () => {
  it('requires consent, aggregates locally, and supports deletion', async () => {
    expect(() =>
      createEntropyExperimentHarness({ consent: { status: 'denied' } }),
    ).toThrow(ExperimentConsentError)

    const harness = createEntropyExperimentHarness({
      consent: {
        status: 'granted',
        purpose: 'unit-lab',
        noticeVersion: 'test-v1',
      },
      maxSamples: 50,
    })

    await harness.collectRebuilds(
      3,
      {
        delayFallback: 0,
        allowNonBrowser: true,
        sources: {
          platform: () => 'Test',
          math: () => ({ acos: 1 }),
        } as never,
      },
      'node-lab',
    )

    const report = harness.aggregate()
    expect(report.revision).toBe(ENTROPY_EXPERIMENTS_REVISION)
    expect(report.disclaimer).toBe(ENTROPY_EXPERIMENT_DISCLAIMER)
    expect(report.sampleCount).toBe(3)
    expect(report.withinBrowser[0]?.cohort).toBe('node-lab')
    expect(report.acrossBrowser.sampleSize).toBe(3)

    harness.clearSamples()
    expect(harness.sampleCount).toBe(0)
    harness.dispose()
    expect(() => harness.aggregate()).toThrow(ExperimentConsentError)
  })

  it('default load unchanged', async () => {
    const result = await (
      await load({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: createBuiltinSources(),
      })
    ).get()
    expect(Object.keys(result.components)).toHaveLength(41)
  })
})

describe('step 71 — server integration design only', () => {
  it('exposes frozen design and no server client exports', () => {
    expect(FIRST_PARTY_SERVER_INTEGRATION_DESIGN.revision).toBe(
      SERVER_INTEGRATION_DESIGN_REVISION,
    )
    expect(FIRST_PARTY_SERVER_INTEGRATION_DESIGN.browserPackageRemainsStandalone).toBe(
      true,
    )
    expect(FIRST_PARTY_SERVER_INTEGRATION_DESIGN.thirdPartyCloudHardcodingForbidden).toBe(
      true,
    )
    expect(
      browserSdkExposesServerClient([
        'load',
        'hashComponents',
        'FIRST_PARTY_SERVER_INTEGRATION_DESIGN',
      ]),
    ).toBe(false)
    expect(browserSdkExposesServerClient(['sendEvidence', 'load'])).toBe(true)
  })
})

describe('step 72 — source metadata registry', () => {
  it('covers 41 sources without applePay and does not alter hash inputs', () => {
    const registry = getSourceMetadataRegistry()
    expect(registry.revision).toBe(SOURCE_METADATA_REGISTRY_REVISION)
    expect(registry.sourceManifestRevision).toBe(SOURCE_MANIFEST_REVISION)
    expect(registry.sourceCount).toBe(41)
    expect(registry.sourceCount).toBe(ENABLED_SOURCE_COUNT)
    expect(registry.excludesApplePay).toBe(true)
    expect(registry.records).toHaveLength(41)
    expect(registry.records.map((r) => r.name)).not.toContain('applePay')

    const canvas = getSourceMetadata('canvas')
    expect(canvas.stability).toBe('volatile')
    expect(canvas.cost).toBe('expensive')
    expect(canvas.privacyCategory).toBe('rendering')

    const components = {
      platform: { value: 'Win32', duration: 1 },
      math: { value: { acos: 1 }, duration: 1 },
    }
    const before = hashComponents(components)
    // Touching metadata must not change hashing.
    void sourceMetadataRegistryToJson(registry)
    expect(hashComponents(components)).toBe(before)
    expect(getSourceMetadataRegistry()).toBe(registry)
  })
})

describe('step 73 — supply chain scripts', () => {
  it('lockfile integrity and vendor audit scripts exist and pass after build', () => {
    expect(existsSync(join(ROOT, 'pnpm-lock.yaml'))).toBe(true)
    expect(existsSync(join(ROOT, 'scripts/ci/lockfile-integrity.mjs'))).toBe(true)
    expect(existsSync(join(ROOT, 'scripts/ci/vendor-bundle-audit.mjs'))).toBe(true)

    execFileSync(process.execPath, ['scripts/ci/lockfile-integrity.mjs'], {
      cwd: ROOT,
      stdio: 'pipe',
    })
    execFileSync(process.execPath, ['scripts/ci/vendor-bundle-audit.mjs'], {
      cwd: ROOT,
      stdio: 'pipe',
    })
  })
})
