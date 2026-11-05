import { expect, test } from '@playwright/test'

test.describe('deviceMemory', () => {
  test('Chromium exposes deviceMemory as number or undefined; Safari/Firefox absence is undefined semantics', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator as Navigator & { deviceMemory?: number }
      const raw = n.deviceMemory
      const parsed = Number.parseFloat(String(raw))
      const value =
        raw === undefined
          ? undefined
          : typeof parsed === 'number' && Number.isNaN(parsed)
            ? undefined
            : parsed

      return {
        typeofRaw: typeof raw,
        value,
        isPositiveNumber: typeof value === 'number' && value > 0 && Number.isFinite(value),
        // Simulate Safari/Firefox: property absent
        safariLike: (() => {
          const fake: { deviceMemory?: number } = {}
          const v = fake.deviceMemory
          const f = Number.parseFloat(String(v))
          return Number.isNaN(f) ? undefined : f
        })(),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(['number', 'undefined']).toContain(report.typeofRaw)
    if (report.typeofRaw === 'number') {
      expect(report.isPositiveNumber).toBe(true)
    } else {
      expect(report.value).toBeUndefined()
    }
    expect(report.safariLike).toBeUndefined()
    expect(report.hostRtl).toBe('rtl')
  })

  test('string coercion, NaN→undefined, Infinity preserved; privacy bucket kept', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const read = (deviceMemory: unknown) => {
        const n = Number.parseFloat(deviceMemory as string)
        return typeof n === 'number' && Number.isNaN(n) ? undefined : n
      }
      return {
        fromString: read('4'),
        fromNan: read(Number.NaN),
        fromInfinity: read(Number.POSITIVE_INFINITY),
        clampedBucket: read(8),
      }
    })
    expect(report.fromString).toBe(4)
    expect(report.fromNan).toBeUndefined()
    expect(report.fromInfinity).toBe(Number.POSITIVE_INFINITY)
    expect(report.clampedBucket).toBe(8)
  })
})
