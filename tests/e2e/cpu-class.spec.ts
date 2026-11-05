import { expect, test } from '@playwright/test'

test.describe('cpuClass', () => {
  test('Chromium has no cpuClass → undefined; inject/spoof reads through; no UA inference', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator as Navigator & { cpuClass?: string }
      const native = n.cpuClass

      Object.defineProperty(navigator, 'cpuClass', {
        configurable: true,
        get() {
          return 'x86'
        },
      })
      const spoofed = (navigator as Navigator & { cpuClass?: string }).cpuClass

      // Mutated then cleared
      Object.defineProperty(navigator, 'cpuClass', {
        configurable: true,
        value: undefined,
      })
      const cleared = (navigator as Navigator & { cpuClass?: string }).cpuClass

      return {
        native,
        spoofed,
        cleared,
        ua: navigator.userAgent,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.native).toBeUndefined()
    expect(report.spoofed).toBe('x86')
    expect(report.cleared).toBeUndefined()
    expect(report.ua.length).toBeGreaterThan(0)
    // Presence of UA must not imply a fabricated cpuClass in native path
    expect(report.native).toBeUndefined()
    expect(report.hostRtl).toBe('rtl')
  })
})
