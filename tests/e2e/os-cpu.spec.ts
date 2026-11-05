import { expect, test } from '@playwright/test'

test.describe('osCpu', () => {
  test('Desktop Chromium has no oscpu → undefined; injected Firefox value reads through', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator as Navigator & { oscpu?: string }
      const native = n.oscpu

      Object.defineProperty(navigator, 'oscpu', {
        configurable: true,
        get() {
          return 'Windows NT 10.0; Win64; x64'
        },
      })
      const injected = (navigator as Navigator & { oscpu?: string }).oscpu

      Object.defineProperty(navigator, 'oscpu', {
        configurable: true,
        get() {
          throw new Error('oscpu blocked')
        },
      })
      let throwMessage: string | undefined
      try {
        void (navigator as Navigator & { oscpu?: string }).oscpu
      } catch (e) {
        throwMessage = e instanceof Error ? e.message : String(e)
      }

      return {
        native,
        injected,
        throwMessage,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.native).toBeUndefined()
    expect(report.injected).toBe('Windows NT 10.0; Win64; x64')
    expect(report.throwMessage).toBe('oscpu blocked')
    expect(report.hostRtl).toBe('rtl')
  })
})
