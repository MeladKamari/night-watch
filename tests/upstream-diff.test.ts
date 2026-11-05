import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  UPSTREAM_PIN,
  hashComponents,
  hashComponentsOmittingExcluded,
  type UnknownComponents,
} from '@night-watch/core'
import { describe, expect, it } from 'vitest'
import {
  buildUpstreamDiffReport,
  diffSource,
  formatDiffReportMarkdown,
  snapshotComponent,
} from './harness/diff/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function identityComponents(): UnknownComponents {
  const components: UnknownComponents = {}
  for (const name of ENABLED_SOURCES) {
    components[name] = { value: name, duration: 1 }
  }
  return components
}

describe('upstream differential harness (fixtures)', () => {
  it('pins the installed upstream package to v5.3.0', () => {
    const pkg = require('@fingerprintjs/fingerprintjs/package.json') as {
      name: string
      version: string
    }
    expect(pkg.name).toBe('@fingerprintjs/fingerprintjs')
    expect(pkg.version).toBe('5.3.0')
    expect(pkg.version).toBe(UPSTREAM_PIN.packageVersion)
    expect(UPSTREAM_PIN.commit).toBe('dac5ae59409669f09aa09c0b2f44b7615b0520da')
  })

  it('refuses non-consented samples', () => {
    const components = identityComponents()
    expect(() =>
      buildUpstreamDiffReport({
        localComponents: components,
        upstreamComponents: components,
        localVisitorId: 'a',
        upstreamRawVisitorId: 'b',
        consented: false as unknown as true,
      }),
    ).toThrow(/consented/)
  })

  it('reports 41/41 and filtered-hash equality when payloads match (applePay omitted in harness)', () => {
    const local = identityComponents()
    const upstream: UnknownComponents = {
      ...local,
      [EXCLUDED_UPSTREAM_SOURCE]: { value: -1, duration: 9 },
    }
    const localVisitorId = hashComponents(local)
    const upstreamRawVisitorId = hashComponents(upstream)

    const report = buildUpstreamDiffReport({
      consented: true,
      localComponents: local,
      upstreamComponents: upstream,
      localVisitorId,
      upstreamRawVisitorId,
      generatedAt: new Date('2026-11-03T00:00:00.000Z'),
    })

    expect(report.matchCount).toBe(41)
    expect(report.mismatchCount).toBe(0)
    expect(report.sourceParityLabel).toBe('41/41')
    expect(report.filteredHashEqual).toBe(true)
    expect(report.localHash).toBe(hashComponentsOmittingExcluded(upstream))
    expect(report.rawVisitorIdEqual).toBe(false)
    expect(report.localVisitorId).not.toBe(report.upstreamRawVisitorId)
    expect(report.sourceRows.every((row) => row.key !== 'applePay')).toBe(true)
    expect(formatDiffReportMarkdown(report)).toContain('41/41')
    expect(formatDiffReportMarkdown(report)).toContain('not a gate')
  })

  it('classifies value/kind mismatches without claiming raw visitorId parity', () => {
    const local = identityComponents()
    const upstream: UnknownComponents = {
      ...local,
      platform: { value: 'Other', duration: 1 },
      fonts: { error: new Error('boom'), duration: 2 },
      applePay: { value: 0, duration: 0 },
    }
    const report = buildUpstreamDiffReport({
      consented: true,
      localComponents: local,
      upstreamComponents: upstream,
      localVisitorId: hashComponents(local),
      upstreamRawVisitorId: hashComponents(upstream),
    })
    expect(report.sourceParityLabel).not.toBe('41/41')
    expect(report.filteredHashEqual).toBe(false)
    expect(report.rawVisitorIdEqual).toBe(false)
    const platform = report.sourceRows.find((row) => row.key === 'platform')
    const fonts = report.sourceRows.find((row) => row.key === 'fonts')
    expect(platform?.kind).toBe('value_mismatch')
    expect(fonts?.kind).toBe('kind_mismatch')
  })

  it('diffSource covers missing arms', () => {
    const value = snapshotComponent({ value: 1, duration: 0 })
    expect(diffSource('x', undefined, value).kind).toBe('missing_local')
    expect(diffSource('x', value, undefined).kind).toBe('missing_upstream')
    expect(diffSource('x', value, value).kind).toBe('match')
  })

  it('never treats unmodified 42-source upstream visitorId as a pass condition', () => {
    const local = identityComponents()
    const upstream: UnknownComponents = {
      ...local,
      applePay: { value: 1, duration: 0 },
    }
    const report = buildUpstreamDiffReport({
      consented: true,
      localComponents: local,
      upstreamComponents: upstream,
      localVisitorId: hashComponents(local),
      upstreamRawVisitorId: hashComponents(upstream),
    })
    // Gate used by tests: filtered equality + source parity — not rawVisitorIdEqual.
    expect(report.filteredHashEqual).toBe(true)
    expect(report.rawVisitorIdEqual).toBe(false)
    expect(report.notes.some((note) => /NOT a release gate/i.test(note))).toBe(true)
  })

  it('upstream IIFE artifact is present for browser harness (offline self-host)', () => {
    const iife = join(root, 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.min.js')
    const body = readFileSync(iife, 'utf8')
    expect(body.length).toBeGreaterThan(1000)
    expect(body).toMatch(/FingerprintJS|fingerprint/i)
  })
})
