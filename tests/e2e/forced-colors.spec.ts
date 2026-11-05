import { expect, test } from '@playwright/test'

test.describe('forcedColors', () => {
  test('Chromium forced-colors is true|false|undefined; RTL intact', async ({ page }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const active = matchMedia('(forced-colors: active)').matches
      const none = matchMedia('(forced-colors: none)').matches
      let value: boolean | undefined
      if (active) {
        value = true
      } else if (none) {
        value = false
      } else {
        value = undefined
      }
      return {
        value,
        active,
        none,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(
      report.value === true || report.value === false || report.value === undefined,
    ).toBe(true)
    // Desktop Chromium without High Contrast usually reports none → false.
    if (report.active) {
      expect(report.value).toBe(true)
    } else if (report.none) {
      expect(report.value).toBe(false)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('unsupported / inject active|none; matchMedia throw surfaces', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        if (mm('(forced-colors: active)').matches) {
          return true
        }
        if (mm('(forced-colors: none)').matches) {
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
        highContrast: detect((q) => ({ matches: q === '(forced-colors: active)' })),
        none: detect((q) => ({ matches: q === '(forced-colors: none)' })),
        threw,
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.highContrast).toBe(true)
    expect(report.none).toBe(false)
    expect(report.threw).toBe(true)
  })
})
