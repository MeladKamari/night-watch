import { expect, test } from '@playwright/test'

const ContrastPreference = {
  Less: -1,
  None: 0,
  More: 1,
  ForcedColors: 10,
} as const

test.describe('contrast', () => {
  test('Chromium prefers-contrast maps to code or undefined; RTL intact', async ({ page }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate((codes) => {
      const doesMatch = (value: string) => matchMedia(`(prefers-contrast: ${value})`).matches
      let value: number | undefined
      if (doesMatch('no-preference')) {
        value = codes.None
      } else if (doesMatch('high') || doesMatch('more')) {
        value = codes.More
      } else if (doesMatch('low') || doesMatch('less')) {
        value = codes.Less
      } else if (doesMatch('forced')) {
        value = codes.ForcedColors
      } else {
        value = undefined
      }

      return {
        value,
        flags: {
          noPreference: doesMatch('no-preference'),
          more: doesMatch('more'),
          high: doesMatch('high'),
          less: doesMatch('less'),
          low: doesMatch('low'),
          forced: doesMatch('forced'),
        },
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, ContrastPreference)

    expect(report.hostRtl).toBe('rtl')
    if (report.value !== undefined) {
      expect([-1, 0, 1, 10]).toContain(report.value)
    }
    // Desktop Chromium often reports no-preference → 0, or undefined if unsupported.
    expect(report.value === undefined || typeof report.value === 'number').toBe(true)
  })

  test('inject keywords + incompatible priority; unsupported → undefined', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((codes) => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        const doesMatch = (value: string) => mm(`(prefers-contrast: ${value})`).matches
        if (doesMatch('no-preference')) {
          return codes.None
        }
        if (doesMatch('high') || doesMatch('more')) {
          return codes.More
        }
        if (doesMatch('low') || doesMatch('less')) {
          return codes.Less
        }
        if (doesMatch('forced')) {
          return codes.ForcedColors
        }
        return undefined
      }

      return {
        missing: detect(null),
        unsupported: detect(() => ({ matches: false })),
        none: detect((q) => ({ matches: q === '(prefers-contrast: no-preference)' })),
        more: detect((q) => ({ matches: q === '(prefers-contrast: more)' })),
        high: detect((q) => ({ matches: q === '(prefers-contrast: high)' })),
        less: detect((q) => ({ matches: q === '(prefers-contrast: less)' })),
        forced: detect((q) => ({ matches: q === '(prefers-contrast: forced)' })),
        incompatible: detect((q) => ({
          matches:
            q === '(prefers-contrast: no-preference)' || q === '(prefers-contrast: forced)',
        })),
      }
    }, ContrastPreference)

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.none).toBe(0)
    expect(report.more).toBe(1)
    expect(report.high).toBe(1)
    expect(report.less).toBe(-1)
    expect(report.forced).toBe(10)
    expect(report.incompatible).toBe(0)
  })
})
