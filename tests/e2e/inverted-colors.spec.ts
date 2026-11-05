import { expect, test } from '@playwright/test'

test.describe('invertedColors', () => {
  test('Chromium inverted-colors is true|false|undefined; RTL intact', async ({ page }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const inverted = matchMedia('(inverted-colors: inverted)').matches
      const none = matchMedia('(inverted-colors: none)').matches
      let value: boolean | undefined
      if (inverted) {
        value = true
      } else if (none) {
        value = false
      } else {
        value = undefined
      }
      return {
        value,
        inverted,
        none,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(
      report.value === true || report.value === false || report.value === undefined,
    ).toBe(true)
    // Chromium typically does not support inverted-colors → undefined, or reports none → false.
    if (report.inverted) {
      expect(report.value).toBe(true)
    } else if (report.none) {
      expect(report.value).toBe(false)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('unsupported / inject tri-states; matchMedia throw surfaces', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        if (mm('(inverted-colors: inverted)').matches) {
          return true
        }
        if (mm('(inverted-colors: none)').matches) {
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
        active: detect((q) => ({ matches: q === '(inverted-colors: inverted)' })),
        none: detect((q) => ({ matches: q === '(inverted-colors: none)' })),
        threw,
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.active).toBe(true)
    expect(report.none).toBe(false)
    expect(report.threw).toBe(true)
  })
})
