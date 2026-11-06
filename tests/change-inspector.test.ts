import {
  CHANGE_INSPECTOR_DISCLAIMER,
  CHANGE_INSPECTOR_REVISION,
  createBuiltinSources,
  formatFingerprintChangeReport,
  hashComponents,
  inspectFingerprintChange,
  inspectFingerprintRebuild,
  load,
  type UnknownComponents,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

function collection(
  components: UnknownComponents,
  visitorId?: string,
): { components: UnknownComponents; visitorId: string } {
  return {
    components,
    visitorId: visitorId ?? hashComponents(components),
  }
}

describe('inspectFingerprintChange', () => {
  it('stable-sorts rows and labels probabilistic disclaimer', () => {
    const before = collection({
      timezone: { value: 'UTC', duration: 1 },
      canvas: { value: { geometry: 'a', text: 't' }, duration: 10 },
      platform: { value: 'Win32', duration: 1 },
    })
    const after = collection({
      platform: { value: 'Win32', duration: 1 },
      canvas: { value: { geometry: 'b', text: 't' }, duration: 12 },
      timezone: { value: 'Asia/Tehran', duration: 1 },
      languages: { value: [['fa-IR']], duration: 2 },
    })

    const report = inspectFingerprintChange(before, after)
    expect(report.revision).toBe(CHANGE_INSPECTOR_REVISION)
    expect(report.disclaimer).toBe(CHANGE_INSPECTOR_DISCLAIMER)
    expect(report.disclaimer.toLowerCase()).toContain('probabilistic')
    expect(report.disclaimer.toLowerCase()).toContain('must not be used as an identity guarantee')

    const sources = report.rows.map((r) => r.source)
    expect(sources).toEqual([...sources].sort())
    expect(report.changes.map((r) => r.source)).toEqual(
      [...report.changes.map((r) => r.source)].sort(),
    )

    const canvas = report.changes.find((r) => r.source === 'canvas')
    expect(canvas?.kind).toBe('value_changed')
    expect(canvas?.expectedInstability).toBe('volatile')
    expect(canvas?.hint.toLowerCase()).toContain('volatile')

    const timezone = report.changes.find((r) => r.source === 'timezone')
    expect(timezone?.kind).toBe('value_changed')
    expect(timezone?.expectedInstability).toBe('moderate')

    const languages = report.changes.find((r) => r.source === 'languages')
    expect(languages?.kind).toBe('added')

    expect(report.visitorIdChanged).toBe(true)
    expect(report.rows.some((r) => r.source === 'applePay')).toBe(false)
  })

  it('classifies error transitions and duration-only deltas', () => {
    const before = collection({
      audio: { value: 1, duration: 5 },
      math: { value: { acos: 1 }, duration: 1 },
    })
    const after = collection({
      audio: { error: new Error('blocked https://evil.example/x'), duration: 8 },
      math: { value: { acos: 1 }, duration: 20 },
    })

    const report = inspectFingerprintChange(before, after, {
      durationDeltaThresholdMs: 5,
    })
    const audio = report.changes.find((r) => r.source === 'audio')
    expect(audio?.kind).toBe('value_to_error')
    expect(audio?.afterPreview).toContain('[url]')
    expect(audio?.afterPreview).not.toContain('evil.example')

    const math = report.changes.find((r) => r.source === 'math')
    expect(math?.kind).toBe('duration_only')
    expect(math?.durationDeltaMs).toBe(19)
  })

  it('never claims device identity; privacy-safe formatting is deterministic', () => {
    const before = collection({
      platform: { value: 'Win32', duration: 1 },
      customProbe: {
        value: { note: 'a', link: 'https://shop.example/?token=abc' },
        duration: 1,
      },
    })
    const after = collection({
      platform: { value: 'Linux', duration: 1 },
      customProbe: {
        value: { note: 'b', link: 'https://shop.example/?token=xyz' },
        duration: 1,
      },
    })
    const report = inspectFingerprintChange(before, after)
    const formatted = formatFingerprintChangeReport(report)
    expect(formatted).toContain(CHANGE_INSPECTOR_DISCLAIMER)
    expect(formatted).toContain('platform')
    const probe = report.changes.find((r) => r.source === 'customProbe')
    expect(probe).toBeDefined()
    expect(probe!.beforePreview).toContain('[url]')
    expect(probe!.afterPreview).toContain('[url]')
    expect(probe!.beforePreview).not.toContain('shop.example')
    expect(formatted.toLowerCase()).toContain('probabilistic')

    const again = formatFingerprintChangeReport(report)
    expect(again).toBe(formatted)
  })

  it('ignores applePay even if present in maps', () => {
    const report = inspectFingerprintChange(
      collection({ applePay: { value: 1, duration: 1 }, platform: { value: 'a', duration: 1 } }),
      collection({ applePay: { value: 2, duration: 1 }, platform: { value: 'b', duration: 1 } }),
    )
    expect(report.rows.some((r) => r.source === 'applePay')).toBe(false)
    expect(report.changes.some((r) => r.source === 'applePay')).toBe(false)
  })
})

describe('default load isolation + rebuild helper', () => {
  it('default load is unchanged when inspector API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).not.toContain('applePay')
  })

  it('inspectFingerprintRebuild compares two gets without network', async () => {
    const { report, formatted, first, second } = await inspectFingerprintRebuild({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: {
        platform: () => 'TestPlatform',
        math: () => ({ acos: 1 }),
      } as never,
      formatStyle: 'text',
    })
    expect(first.visitorId).toBe(second.visitorId)
    expect(report.visitorIdChanged).toBe(false)
    expect(report.disclaimer).toBe(CHANGE_INSPECTOR_DISCLAIMER)
    expect(formatted).toContain(CHANGE_INSPECTOR_REVISION)
  })
})
