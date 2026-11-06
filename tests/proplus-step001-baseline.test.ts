/**
 * STEP 001 — visitorId / algorithm stability lock across the Pro+ inventory step.
 * Compares deterministic hash outputs to the frozen golden fixture (before ≡ after).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALGORITHM_SCHEMA,
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  SOURCE_MANIFEST_REVISION,
  createBuiltinSources,
  hashComponents,
  type UnknownComponents,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function sha256Prefix(relativePath: string, length = 16): string {
  const digest = createHash('sha256')
    .update(readFileSync(join(root, relativePath)))
    .digest('hex')
  return digest.slice(0, length)
}

const inventory = JSON.parse(
  readFileSync(join(root, 'docs/proplus-inventory/existing-sdk-inventory.json'), 'utf8'),
) as {
  algorithmRevision: {
    sourceManifestRevision: string
    hashingRevision: string
    confidenceRevision: string
    excludedUpstreamSource: string
    enabledSourceCount: number
  }
  visitorIdStabilityLocks: {
    identitySourcesSelfHash: string
    componentsSampleHash: string
    componentsErrorNullHash: string
  }
  algorithmFileSha256Prefix: Record<string, string>
  enabledSources: Array<{ order: number; name: string; status: string }>
  packages: Array<{ name: string }>
}

const golden = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/hash-golden-vectors.json'), 'utf8'),
) as {
  componentsSample: { hash: string }
  componentsErrorNull: { hash: string }
  identitySourcesSelfHash: { hash: string }
}

describe('STEP 001 Pro+ baseline inventory', () => {
  it('enumerates all workspace SDK packages', () => {
    const names = inventory.packages.map((p) => p.name).sort()
    expect(names).toEqual(['@thenightwatch/browser-sdk', '@thenightwatch/core', '@thenightwatch/playground'].sort())
  })

  it('enumerates all 41 Default-profile sources with IMPLEMENTED status', () => {
    expect(inventory.enabledSources).toHaveLength(41)
    expect(inventory.enabledSources.map((s) => s.name)).toEqual([...ENABLED_SOURCES])
    expect(inventory.enabledSources.every((s) => s.status === 'IMPLEMENTED')).toBe(true)
    expect(inventory.algorithmRevision.enabledSourceCount).toBe(41)
    expect(inventory.algorithmRevision.excludedUpstreamSource).toBe('applePay')
  })

  it('locks ALGORITHM_SCHEMA revisions used for visitorId', () => {
    expect(SOURCE_MANIFEST_REVISION).toBe('default-v1')
    expect(ALGORITHM_SCHEMA.sourceManifestRevision).toBe(
      inventory.algorithmRevision.sourceManifestRevision,
    )
    expect(ALGORITHM_SCHEMA.hashingRevision).toBe(inventory.algorithmRevision.hashingRevision)
    expect(ALGORITHM_SCHEMA.confidenceRevision).toBe(
      inventory.algorithmRevision.confidenceRevision,
    )
    expect(EXCLUDED_UPSTREAM_SOURCE).toBe('applePay')
    expect(ENABLED_SOURCES).not.toContain('applePay')
  })

  it('keeps visitorId hashes identical to pre-step golden locks (before === after)', () => {
    const identity: UnknownComponents = Object.fromEntries(
      ENABLED_SOURCES.map((name) => [name, { value: name, duration: 0 }]),
    )
    const sample: UnknownComponents = {
      b: { value: 1, duration: 9 },
      a: { value: 'x', duration: 1 },
    }
    const withError: UnknownComponents = {
      z: { error: new Error('boom'), duration: 2 },
      a: { value: null, duration: 1 },
    }

    const afterIdentity = hashComponents(identity)
    const afterSample = hashComponents(sample)
    const afterError = hashComponents(withError)

    expect(afterIdentity).toBe(golden.identitySourcesSelfHash.hash)
    expect(afterSample).toBe(golden.componentsSample.hash)
    expect(afterError).toBe(golden.componentsErrorNull.hash)

    expect(afterIdentity).toBe(inventory.visitorIdStabilityLocks.identitySourcesSelfHash)
    expect(afterSample).toBe(inventory.visitorIdStabilityLocks.componentsSampleHash)
    expect(afterError).toBe(inventory.visitorIdStabilityLocks.componentsErrorNullHash)
  })

  it('wires all 41 builtin collectors (none left as not-implemented stubs)', () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)).toHaveLength(41)
    for (const name of ENABLED_SOURCES) {
      const body = Function.prototype.toString.call(sources[name])
      expect(body.includes('SourceNotImplementedError')).toBe(false)
    }
  })

  it('keeps critical algorithm file digests unchanged from inventory snapshot', () => {
    for (const [relativePath, expectedPrefix] of Object.entries(
      inventory.algorithmFileSha256Prefix,
    )) {
      expect(sha256Prefix(relativePath)).toBe(expectedPrefix)
    }
  })
})
