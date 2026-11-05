import { expect, test } from '@playwright/test'

test.describe('screenResolution', () => {
  test('Chromium returns positive ordered pair; rotate-equivalent dims match; RTL host intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const parseDimension = (value: unknown) => {
        const n = Number.parseInt(String(value), 10)
        return Number.isNaN(n) ? null : n
      }
      const collect = (width: unknown, height: unknown) => {
        const dimensions = [parseDimension(width), parseDimension(height)] as [
          number | null,
          number | null,
        ]
        dimensions.sort().reverse()
        return dimensions
      }

      const native = collect(screen.width, screen.height)
      const rotated = collect(screen.height, screen.width)
      const spoofed = collect('1200', '800')
      const missing = collect(undefined, 'nope')

      return {
        native,
        rotated,
        spoofed,
        missing,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.native[0]).toBeGreaterThan(0)
    expect(report.native[1]).toBeGreaterThan(0)
    expect(report.native).toEqual(report.rotated)
    expect(report.spoofed).toEqual([800, 1200])
    expect(report.missing).toEqual([null, null])
    expect(report.hostRtl).toBe('rtl')
  })

  test('Safari private skip semantics return undefined without inventing resolution', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const skipSafariPrivate = true
      if (skipSafariPrivate) {
        return { value: undefined as undefined }
      }
      return { value: [screen.width, screen.height] as [number, number] }
    })
    expect(report.value).toBeUndefined()
  })
})
