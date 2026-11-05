import { compareSnapshots } from '../apps/playground/src/compare.js'
import {
  formatDualNumber,
  formatLatinNumber,
  summarizeError,
  summarizeValue,
  toPersianDigits,
} from '../apps/playground/src/format.js'
import {
  componentsToSignalRows,
  snapshotFromResult,
  snapshotToCopyJson,
  type PlaygroundSnapshot,
} from '../apps/playground/src/snapshot.js'
import type { GetResult } from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

function sampleSnapshot(overrides: Partial<PlaygroundSnapshot> = {}): PlaygroundSnapshot {
  return {
    visitorId: '0123456789abcdef0123456789abcdef',
    confidenceScore: 0.6,
    confidenceComment: 'Heuristic',
    version: '0.0.0',
    sourceManifestRevision: 'default-v1',
    enabledSourceCount: 41,
    collectedAtIso: '2026-11-03T00:00:00.000Z',
    signals: [
      {
        key: 'platform',
        kind: 'value',
        summary: '"Win32"',
        durationMs: 1.2,
        exportValue: 'Win32',
      },
      {
        key: 'fonts',
        kind: 'error',
        summary: 'UnsupportedEnvironmentError: no document',
        durationMs: 0.5,
        exportValue: { name: 'UnsupportedEnvironmentError', message: 'no document' },
      },
    ],
    errorKeys: ['fonts'],
    ...overrides,
  }
}

describe('playground format helpers', () => {
  it('maps Latin digits to Persian without altering non-digits', () => {
    expect(toPersianDigits('41 ms')).toBe('۴۱ ms')
    expect(toPersianDigits('0.60')).toBe('۰.۶۰')
    expect(toPersianDigits('abc')).toBe('abc')
  })

  it('dual number display keeps Latin canonical and Persian mirror', () => {
    expect(formatLatinNumber(12.345, 2)).toBe('12.35')
    expect(formatDualNumber(12.345, 2)).toEqual({ latin: '12.35', persian: '۱۲.۳۵' })
  })

  it('summarizes values and readable errors', () => {
    expect(summarizeValue({ a: 1 })).toBe('{"a":1}')
    expect(summarizeError(new Error('boom'))).toMatch(/^Error: boom/)
    expect(summarizeError('plain')).toBe('plain')
  })
})

describe('playground snapshot + compare', () => {
  it('builds signal rows with value/error kinds and copy JSON', () => {
    const result = {
      visitorId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      confidence: { score: 0.4, comment: 'note' },
      version: '0.0.0',
      components: {
        platform: { value: 'Linux', duration: 2 },
        canvas: { error: new Error('blocked'), duration: 3 },
      },
    } as unknown as GetResult

    const rows = componentsToSignalRows(result.components)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.kind).toBe('value')
    expect(rows[1]?.kind).toBe('error')
    expect(rows[1]?.summary).toMatch(/blocked/)

    const snap = snapshotFromResult(result, new Date('2026-11-03T12:00:00.000Z'))
    expect(snap.errorKeys).toEqual(['canvas'])
    expect(snap.sourceManifestRevision).toBe('default-v1')
    expect(snap.enabledSourceCount).toBe(41)

    const json = snapshotToCopyJson(snap)
    expect(json).toContain('"visitorId"')
    expect(json).toContain('canvas')
    expect(json).not.toContain('applePay')
  })

  it('compares independent runs for changed keys and visitorId', () => {
    const previous = sampleSnapshot()
    const current = sampleSnapshot({
      visitorId: 'ffffffffffffffffffffffffffffffff',
      signals: [
        {
          key: 'platform',
          kind: 'value',
          summary: '"Linux"',
          durationMs: 1.2,
          exportValue: 'Linux',
        },
        {
          key: 'timezone',
          kind: 'value',
          summary: '"Asia/Tehran"',
          durationMs: 0.2,
          exportValue: 'Asia/Tehran',
        },
      ],
      errorKeys: [],
      confidenceScore: 0.55,
    })
    const diff = compareSnapshots(previous, current)
    expect(diff.visitorIdChanged).toBe(true)
    expect(diff.changedKeys).toContain('platform')
    expect(diff.onlyInPrevious).toContain('fonts')
    expect(diff.onlyInCurrent).toContain('timezone')
    expect(diff.confidenceScoreDelta).toBeCloseTo(-0.05)
  })
})
