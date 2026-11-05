import { expect, test } from '@playwright/test'

test.describe('hardwareConcurrency', () => {
  test('Chromium reports positive cores; Firefox tiering is idempotent 4|8; RTL host intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const toInt = (v: unknown) => Number.parseInt(String(v), 10)
      const replaceNaN = (v: number) => (Number.isNaN(v) ? undefined : v)
      const raw = replaceNaN(toInt(navigator.hardwareConcurrency))
      const tier = (value: number | undefined) => {
        if (value === undefined) {
          return undefined
        }
        return value >= 8 ? 8 : 4
      }

      return {
        raw,
        tieredFrom1: tier(1),
        tieredFrom4: tier(4),
        tieredFrom8: tier(8),
        tieredFrom16: tier(16),
        malformed: replaceNaN(toInt('nope')),
        absent: replaceNaN(toInt(undefined)),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.raw).toBeGreaterThan(0)
    expect(report.tieredFrom1).toBe(4)
    expect(report.tieredFrom4).toBe(4)
    expect(report.tieredFrom8).toBe(8)
    expect(report.tieredFrom16).toBe(8)
    expect(report.malformed).toBeUndefined()
    expect(report.absent).toBeUndefined()
    expect(report.hostRtl).toBe('rtl')
  })
})
