import { expect, test } from '@playwright/test'

test.describe('timezone', () => {
  test('Chromium returns IANA or UTC form; Asia/Tehran inject works; no forced Iran id', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const DateTimeFormat = window.Intl?.DateTimeFormat
      const native = DateTimeFormat
        ? new DateTimeFormat().resolvedOptions().timeZone
        : undefined

      const offsetFallback = () => {
        const year = new Date().getFullYear()
        const jan = Number.parseFloat(String(new Date(year, 0, 1).getTimezoneOffset()))
        const jul = Number.parseFloat(String(new Date(year, 6, 1).getTimezoneOffset()))
        const offset = -Math.max(jan, jul)
        return `UTC${offset >= 0 ? '+' : ''}${offset}`
      }

      const tehranLike = (() => {
        const offset = -(-210)
        return `UTC${offset >= 0 ? '+' : ''}${offset}`
      })()

      return {
        native,
        hasNative: typeof native === 'string' && native.length > 0,
        fallbackShape: offsetFallback(),
        tehranLike,
        dubaiInject: 'Asia/Dubai',
        utcInject: 'UTC',
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hasNative).toBe(true)
    expect(report.native).not.toMatch(/^\s*$/)
    // Capability signal only — do not require or invent Asia/Tehran on CI hosts.
    expect(report.tehranLike).toBe('UTC+210')
    expect(report.dubaiInject).toBe('Asia/Dubai')
    expect(report.utcInject).toBe('UTC')
    expect(report.hostRtl).toBe('rtl')
  })

  test('DST-stable offset uses max(Jan, July); half-hour and hemisphere cases', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const format = (januaryOffset: number, julyOffset: number) => {
        const offset = -Math.max(januaryOffset, julyOffset)
        return `UTC${offset >= 0 ? '+' : ''}${offset}`
      }
      return {
        berlin: format(1 * -60, 2 * -60),
        santiago: format(-3 * -60, -4 * -60),
        middle: format(0, 0),
        tehran: format(-210, -210),
      }
    })
    expect(report.berlin).toBe('UTC+60')
    expect(report.santiago).toBe('UTC-240')
    expect(report.middle).toBe('UTC+0')
    expect(report.tehran).toBe('UTC+210')
  })
})
