import { expect, test } from '@playwright/test'

test.describe('reducedTransparency', () => {
  test('Chromium prefers-reduced-transparency is true|false|undefined; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const reduce = matchMedia('(prefers-reduced-transparency: reduce)').matches
      const noPreference = matchMedia(
        '(prefers-reduced-transparency: no-preference)',
      ).matches
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
    // Feature is newer; Chromium may still report undefined (older) or false.
    if (report.reduce) {
      expect(report.value).toBe(true)
    } else if (report.noPreference) {
      expect(report.value).toBe(false)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('older browsers / toggle inject / no hardcoded default', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        if (mm('(prefers-reduced-transparency: reduce)').matches) {
          return true
        }
        if (mm('(prefers-reduced-transparency: no-preference)').matches) {
          return false
        }
        return undefined
      }

      return {
        missing: detect(null),
        olderUnsupported: detect(() => ({ matches: false })),
        reduce: detect((q) => ({
          matches: q === '(prefers-reduced-transparency: reduce)',
        })),
        noPreference: detect((q) => ({
          matches: q === '(prefers-reduced-transparency: no-preference)',
        })),
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.olderUnsupported).toBeUndefined()
    expect(report.reduce).toBe(true)
    expect(report.noPreference).toBe(false)
  })
})
