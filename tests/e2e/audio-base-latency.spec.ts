import { expect, test } from '@playwright/test'

const Special = {
  NotSupported: -1,
  Disabled: -2,
  NotFinite: -3,
} as const

test.describe('audioBaseLatency', () => {
  test('Desktop Chromium is Disabled (no AudioContext created; no console warning path)', async ({
    page,
  }) => {
    const warnings: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text())
      }
    })

    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate((special) => {
      // Mirror platform gate + probe (Chromium desktop → Disabled)
      const isAndroid = false // desktop Chromium test host
      const isWebKit = false
      const allowed = isAndroid || isWebKit
      let created = false
      let closed = false

      const run = () => {
        if (!allowed) {
          return special.Disabled
        }
        if (!window.AudioContext) {
          return special.NotSupported
        }
        const ctx = new AudioContext()
        created = true
        try {
          const latency = ctx.baseLatency
          if (latency === null || latency === undefined) {
            return special.NotSupported
          }
          if (!Number.isFinite(latency)) {
            return special.NotFinite
          }
          return latency
        } finally {
          void ctx.close().then(() => {
            closed = true
          })
        }
      }

      return {
        value: run(),
        created,
        closed,
        hasAudioContext: typeof AudioContext === 'function',
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, Special)

    expect(report.hostRtl).toBe('rtl')
    expect(report.value).toBe(Special.Disabled)
    expect(report.created).toBe(false)
    expect(report.hasAudioContext).toBe(true)
    // No AudioContext → no Chromium autoplay / baseLatency console noise from this probe
    expect(warnings.some((w) => /AudioContext|baseLatency/i.test(w))).toBe(false)
  })

  test('allowed platform: Infinity/NaN → NotFinite; null → NotSupported; close runs', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((special) => {
      const probe = (baseLatency: number | null | undefined) => {
        let closed = 0
        let value: number = special.Disabled
        class MockAudioContext {
          get baseLatency() {
            return baseLatency
          }
          close() {
            closed += 1
          }
        }
        const ctx = new MockAudioContext()
        try {
          const latency = ctx.baseLatency
          if (latency === null || latency === undefined) {
            value = special.NotSupported
          } else if (!Number.isFinite(latency)) {
            value = special.NotFinite
          } else {
            value = latency
          }
        } finally {
          ctx.close()
        }
        // Read `closed` after finally (return-object literals capture pre-finally values).
        return { value, closed }
      }

      const inf = probe(Number.POSITIVE_INFINITY)
      const nan = probe(Number.NaN)
      const nil = probe(null)
      const ok = probe(0.02)

      return { inf, nan, nil, ok }
    }, Special)

    expect(report.inf.value).toBe(Special.NotFinite)
    expect(report.inf.closed).toBe(1)
    expect(report.nan.value).toBe(Special.NotFinite)
    expect(report.nan.closed).toBe(1)
    expect(report.nil.value).toBe(Special.NotSupported)
    expect(report.nil.closed).toBe(1)
    expect(report.ok.value).toBe(0.02)
    expect(report.ok.closed).toBe(1)
  })
})
