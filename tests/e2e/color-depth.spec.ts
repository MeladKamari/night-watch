import { expect, test } from '@playwright/test'

/** Upstream-accepted native depths (FingerprintJS OSS v5.3.0 color_depth.test). */
const KNOWN_DEPTHS = [48, 36, 32, 30, 24, 18, 16, 15, 12, 8, 0]

test.describe('colorDepth', () => {
  test('Chromium screen.colorDepth is a known integer; RTL host does not alter it', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const depth = window.screen.colorDepth
      return {
        depth,
        isNumber: typeof depth === 'number',
        isInteger: Number.isInteger(depth),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.isNumber).toBe(true)
    expect(report.isInteger).toBe(true)
    expect(KNOWN_DEPTHS).toContain(report.depth)
    expect(report.hostRtl).toBe('rtl')
  })

  test('zero and NaN inject preserve values; missing screen → undefined semantics', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const read = (screenLike: { colorDepth?: number } | null | undefined) => {
        if (screenLike == null) {
          return undefined
        }
        return screenLike.colorDepth
      }
      return {
        zero: read({ colorDepth: 0 }),
        nan: read({ colorDepth: Number.NaN }),
        missing: read(null),
        absentProp: read({}),
      }
    })
    expect(report.zero).toBe(0)
    expect(Number.isNaN(report.nan)).toBe(true)
    expect(report.missing).toBeUndefined()
    expect(report.absentProp).toBeUndefined()
  })
})
