import { expect, test } from '@playwright/test'

test.describe('monochrome', () => {
  test('Chromium monochrome depth is 0|positive|undefined; RTL intact', async ({ page }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const maxCheck = 100
      let value: number | undefined
      let threw = false
      try {
        if (!matchMedia('(min-monochrome: 0)').matches) {
          value = undefined
        } else {
          value = undefined
          for (let i = 0; i <= maxCheck; ++i) {
            if (matchMedia(`(max-monochrome: ${i})`).matches) {
              value = i
              break
            }
          }
          if (value === undefined) {
            threw = true
          }
        }
      } catch {
        threw = true
      }

      return {
        value,
        threw,
        supported: matchMedia('(min-monochrome: 0)').matches,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.threw).toBe(false)
    if (report.supported) {
      expect(typeof report.value).toBe('number')
      expect(report.value!).toBeGreaterThanOrEqual(0)
      expect(report.value!).toBeLessThanOrEqual(100)
    } else {
      expect(report.value).toBeUndefined()
    }
  })

  test('unsupported / depth injects; bound prevents infinite loop; throw surfaces', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const maxCheck = 100
      const detect = (
        mm: ((q: string) => { matches: boolean }) | null,
      ): number | undefined => {
        if (!mm) {
          return undefined
        }
        if (!mm('(min-monochrome: 0)').matches) {
          return undefined
        }
        for (let i = 0; i <= maxCheck; ++i) {
          if (mm(`(max-monochrome: ${i})`).matches) {
            return i
          }
        }
        throw new Error('Too high value')
      }

      const makeDepth = (depth: number) => (query: string) => {
        if (query === '(min-monochrome: 0)') {
          return { matches: true }
        }
        const m = /^\(max-monochrome: (\d+)\)$/.exec(query)
        if (m) {
          return { matches: Number(m[1]) >= depth }
        }
        return { matches: false }
      }

      let tooHighThrew = false
      let calls = 0
      try {
        detect((q) => {
          calls += 1
          return q === '(min-monochrome: 0)' ? { matches: true } : { matches: false }
        })
      } catch {
        tooHighThrew = true
      }

      return {
        missing: detect(null),
        unsupported: detect(() => ({ matches: false })),
        depth0: detect(makeDepth(0)),
        depth8: detect(makeDepth(8)),
        tooHighThrew,
        calls,
      }
    })

    expect(report.missing).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.depth0).toBe(0)
    expect(report.depth8).toBe(8)
    expect(report.tooHighThrew).toBe(true)
    expect(report.calls).toBe(102)
  })
})
