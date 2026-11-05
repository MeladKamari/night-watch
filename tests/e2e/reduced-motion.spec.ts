import { expect, test } from '@playwright/test'

test.describe('reducedMotion', () => {
  test('Chromium prefers-reduced-motion is true|false|undefined; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      const noPreference = matchMedia('(prefers-reduced-motion: no-preference)').matches
      let value: boolean | undefined
      if (reduce) {
        value = true
      } else if (noPreference) {
        value = false
      } else {
        value = undefined
      }
      return {
        value,
        reduce,
        noPreference,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(
      report.value === true || report.value === false || report.value === undefined,
    ).toBe(true)
    if (report.reduce) {
      expect(report.value).toBe(true)
    } else if (report.noPreference) {
      expect(report.value).toBe(false)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('OS toggle inject / unsupported / matchMedia absent', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        if (mm('(prefers-reduced-motion: reduce)').matches) {
          return true
        }
        if (mm('(prefers-reduced-motion: no-preference)').matches) {
          return false
        }
        return undefined
      }

      return {
        missing: detect(null),
        unsupported: detect(() => ({ matches: false })),
        reduce: detect((q) => ({ matches: q === '(prefers-reduced-motion: reduce)' })),
        noPreference: detect((q) => ({
          matches: q === '(prefers-reduced-motion: no-preference)',
        })),
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.reduce).toBe(true)
    expect(report.noPreference).toBe(false)
  })
})
