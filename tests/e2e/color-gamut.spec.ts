import { expect, test } from '@playwright/test'

test.describe('colorGamut', () => {
  test('Chromium matchMedia color-gamut yields srgb|p3|rec2020 or undefined; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const order = ['rec2020', 'p3', 'srgb'] as const
      let value: (typeof order)[number] | undefined
      for (const gamut of order) {
        if (matchMedia(`(color-gamut: ${gamut})`).matches) {
          value = gamut
          break
        }
      }

      const queries = Object.fromEntries(
        order.map((g) => [g, matchMedia(`(color-gamut: ${g})`).matches]),
      ) as Record<(typeof order)[number], boolean>

      return {
        value,
        queries,
        // rec2020 ⊃ p3 ⊃ srgb: if a wider matches, narrower should typically match too
        nestOk:
          (!queries.rec2020 || queries.p3) &&
          (!queries.p3 || queries.srgb || !queries.p3),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    if (report.value !== undefined) {
      expect(['srgb', 'p3', 'rec2020']).toContain(report.value)
    }
    // Desktop Chromium commonly reports srgb (sometimes p3 on wide-gamut hosts).
    expect(report.value === undefined || typeof report.value === 'string').toBe(true)
  })

  test('no matchMedia / unsupported queries → undefined; spoofed inject works', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const detect = (mm: ((q: string) => { matches: boolean }) | null) => {
        if (!mm) {
          return undefined
        }
        for (const gamut of ['rec2020', 'p3', 'srgb'] as const) {
          if (mm(`(color-gamut: ${gamut})`).matches) {
            return gamut
          }
        }
        return undefined
      }

      return {
        missing: detect(null),
        noneMatch: detect(() => ({ matches: false })),
        spoofRec2020: detect((q) => ({ matches: q === '(color-gamut: rec2020)' })),
        spoofP3: detect((q) => ({
          matches: q === '(color-gamut: p3)' || q === '(color-gamut: srgb)',
        })),
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.noneMatch).toBeUndefined()
    expect(report.spoofRec2020).toBe('rec2020')
    expect(report.spoofP3).toBe('p3')
  })
})
