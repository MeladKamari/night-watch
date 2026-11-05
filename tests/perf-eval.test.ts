import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENABLED_SOURCES, SOURCE_MANIFEST_REVISION } from '@night-watch/core'
import { describe, expect, it } from 'vitest'
import {
  buildPerfEntropyReport,
  flagRelativeExpensive,
  formatPerfEntropyMarkdown,
  measureBundleSizes,
  percentile,
  summarizeCollisions,
  summarizeDurations,
  summarizeStability,
  type CollectTimingSample,
} from './harness/perf/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sdkDist = join(root, 'packages/browser-sdk/dist')

function fakeSample(wallMs: number, visitorId: string, durations: Record<string, number>): CollectTimingSample {
  return {
    wallMs,
    visitorId,
    sourceDurationsMs: durations,
    errorKeys: [],
  }
}

describe('perf eval stats', () => {
  it('computes nearest-rank percentiles on known fixtures', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(sorted, 50)).toBe(5)
    expect(percentile(sorted, 95)).toBe(10)
    expect(percentile(sorted, 99)).toBe(10)
    expect(percentile([], 50)).toBe(0)
  })

  it('summarizes durations with p50/p95/p99', () => {
    const stats = summarizeDurations([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(stats.sampleSize).toBe(10)
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(100)
    expect(stats.mean).toBe(55)
    expect(stats.p50).toBe(50)
    expect(stats.p95).toBe(100)
    expect(stats.p99).toBe(100)
  })

  it('flags relative expensive sources without absolute budgets', () => {
    // Median of this set is ~1; threshold = max(1,1)*3 = 3 → only `slow` flags.
    const expensive = flagRelativeExpensive(
      { a: 0, b: 0, c: 1, d: 1, e: 2, slow: 20, noise: 0.1 },
      3,
    )
    expect(expensive.has('slow')).toBe(true)
    expect(expensive.has('e')).toBe(false)
    expect(expensive.has('noise')).toBe(false)
  })
})

describe('stability + collision cohorts', () => {
  it('reports majority share over 20 identical ids', () => {
    const ids = Array.from({ length: 20 }, () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const run = summarizeStability('reload×20', ids, ['same profile'])
    expect(run.uniqueCount).toBe(1)
    expect(run.majorityShare).toBe(1)
    expect(run.visitorIds).toHaveLength(20)
  })

  it('computes uniqueness ratio and collision pairs', () => {
    const cohort = summarizeCollisions('mixed', ['a', 'a', 'b', 'c', 'c', 'c'])
    expect(cohort.uniqueVisitorIds).toBe(3)
    expect(cohort.sampleSize).toBe(6)
    expect(cohort.uniquenessRatio).toBeCloseTo(0.5)
    // C(2,2)=1 for a; C(3,2)=3 for c → 4
    expect(cohort.collisionPairsApprox).toBe(4)
  })
})

describe('perf entropy report builder', () => {
  it('refuses non-consented input', () => {
    expect(() =>
      buildPerfEntropyReport({
        consented: false as unknown as true,
        samples: [fakeSample(1, 'x', { fonts: 1 })],
        environment: {
          userAgent: 'test',
          browserName: 'chromium',
          headless: true,
          locale: 'en-US',
          timezoneId: 'UTC',
          viewport: { width: 800, height: 600 },
          deviceClass: 'desktop',
        },
        sdkVersion: '0.0.0',
        stability: [],
        modeComparisons: [],
        collisions: [],
        bundleSizes: [],
      }),
    ).toThrow(/consented/)
  })

  it('aggregates wall + source costs and renders markdown', () => {
    const durations: Record<string, number> = {}
    for (const name of ENABLED_SOURCES) {
      durations[name] = name === 'fonts' ? 30 : 1
    }
    const samples = [
      fakeSample(100, 'id1', durations),
      fakeSample(120, 'id1', durations),
      fakeSample(110, 'id1', durations),
    ]
    const report = buildPerfEntropyReport({
      consented: true,
      samples,
      generatedAt: new Date('2026-11-03T12:00:00.000Z'),
      environment: {
        userAgent: 'Vitest',
        browserName: 'node',
        headless: true,
        locale: 'en-US',
        timezoneId: 'UTC',
        viewport: undefined,
        deviceClass: 'fixture',
      },
      sdkVersion: '0.0.0-test',
      stability: [summarizeStability('fixture', ['id1', 'id1', 'id1'])],
      modeComparisons: [
        {
          modeA: 'ltr',
          modeB: 'rtl',
          visitorIdEqual: true,
          visitorIdA: 'id1',
          visitorIdB: 'id1',
          notes: ['direction-only'],
        },
      ],
      collisions: [summarizeCollisions('same-profile', ['id1', 'id1', 'id1'])],
      bundleSizes: [{ path: 'fp.min.js', bytesUncompressed: 1, bytesGzip: 1 }],
      operationalNotes: ['fixture only'],
      notRun: ['real mid-range Android hardware'],
      relativeExpensiveFactor: 3,
    })

    expect(report.algorithm.sourceManifestRevision).toBe(SOURCE_MANIFEST_REVISION)
    expect(report.algorithm.enabledSourceCount).toBe(41)
    expect(report.wallClock.sampleSize).toBe(3)
    expect(report.wallClock.p50).toBe(110)
    expect(report.sourceCosts[0]?.key).toBe('fonts')
    expect(report.sourceCosts[0]?.expensiveRelative).toBe(true)
    expect(report.sourceCosts.every((row) => !row.key.includes('applePay'))).toBe(true)

    const md = formatPerfEntropyMarkdown(report)
    expect(md).toContain('Performance, stability & entropy')
    expect(md).toContain('fonts')
    expect(md).toContain('NOT RUN')
    expect(md).toContain('real mid-range Android hardware')
  })
})

describe('bundle size measurement', () => {
  it('gzips published IIFE/ESM artifacts when dist exists', () => {
    const rows = measureBundleSizes(sdkDist)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const iife = rows.find((r) => r.path === 'fp.min.js')
    expect(iife).toBeDefined()
    expect(iife!.bytesUncompressed).toBeGreaterThan(1000)
    expect(iife!.bytesGzip).toBeGreaterThan(500)
    expect(iife!.bytesGzip).toBeLessThan(iife!.bytesUncompressed)
  })
})
