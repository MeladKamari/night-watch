import { expect, test } from '@playwright/test'

test.describe('pdfViewerEnabled', () => {
  test('Chromium exposes boolean or undefined; true/false inject; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator as Navigator & { pdfViewerEnabled?: boolean }
      const native = n.pdfViewerEnabled
      const nativeType = typeof native

      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        configurable: true,
        get() {
          return true
        },
      })
      const spoofTrue = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled

      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        configurable: true,
        get() {
          return false
        },
      })
      const spoofFalse = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled

      return {
        native,
        nativeType,
        spoofTrue,
        spoofFalse,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.spoofTrue).toBe(true)
    expect(report.spoofFalse).toBe(false)
    // Desktop Chromium typically true; accept boolean | undefined
    expect(
      report.nativeType === 'boolean' || report.native === undefined,
    ).toBe(true)
    if (report.nativeType === 'boolean') {
      expect(typeof report.native).toBe('boolean')
    }
  })

  test('unsupported / undefined getter; no PDF opened', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        configurable: true,
        get() {
          return undefined
        },
      })
      const undefGetter = (navigator as Navigator & { pdfViewerEnabled?: boolean })
        .pdfViewerEnabled

      const absent = {} as { pdfViewerEnabled?: boolean }
      const unsupported = absent.pdfViewerEnabled

      return {
        undefGetter,
        unsupported,
        // Probe did not navigate or create embeds
        embedCount: document.querySelectorAll('embed, object, iframe').length,
        locationIsBlankish:
          location.href.startsWith('about:') || location.href.startsWith('data:'),
      }
    })

    expect(report.undefGetter).toBeUndefined()
    expect(report.unsupported).toBeUndefined()
    expect(report.embedCount).toBe(0)
    expect(report.locationIsBlankish).toBe(true)
  })
})
