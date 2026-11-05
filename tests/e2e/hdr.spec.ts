import { expect, test } from '@playwright/test'

test.describe('hdr', () => {
  test('Chromium dynamic-range is true|false|undefined; RTL intact', async ({ page }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const high = matchMedia('(dynamic-range: high)').matches
      const standard = matchMedia('(dynamic-range: standard)').matches
      let value: boolean | undefined
      if (high) {
        value = true
      } else if (standard) {
        value = false
      } else {
        value = undefined
      }
      return {
        value,
        high,
        standard,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(
      report.value === true || report.value === false || report.value === undefined,
    ).toBe(true)
    // Desktop Chromium on SDR typically reports standard → false.
    if (report.high) {
      expect(report.value).toBe(true)
    } else if (report.standard) {
      expect(report.value).toBe(false)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('HDR/SDR inject; unsupported; matchMedia exception', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        if (mm('(dynamic-range: high)').matches) {
          return true
        }
        if (mm('(dynamic-range: standard)').matches) {
          return false
        }
        return undefined
      }

      let threw = false
      try {
        detect(() => {
          throw new Error('matchMedia blocked')
        })
      } catch {
        threw = true
      }

      return {
        missing: detect(null),
        unsupported: detect(() => ({ matches: false })),
        hdr: detect((q) => ({ matches: q === '(dynamic-range: high)' })),
        sdr: detect((q) => ({ matches: q === '(dynamic-range: standard)' })),
        threw,
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.hdr).toBe(true)
    expect(report.sdr).toBe(false)
    expect(report.threw).toBe(true)
  })
})
