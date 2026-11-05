import { expect, test } from '@playwright/test'

test.describe('platform', () => {
  test('Chromium returns a non-empty platform; MacIntel remap semantics; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const native = navigator.platform

      const remap = (
        platform: string,
        opts: { isWebKit: boolean; isDesktopWebKit: boolean; isIPad: boolean },
      ) => {
        if (platform === 'MacIntel' && opts.isWebKit && !opts.isDesktopWebKit) {
          return opts.isIPad ? 'iPad' : 'iPhone'
        }
        return platform
      }

      return {
        native,
        iPadDesktopMode: remap('MacIntel', {
          isWebKit: true,
          isDesktopWebKit: false,
          isIPad: true,
        }),
        iPhoneDesktopMode: remap('MacIntel', {
          isWebKit: true,
          isDesktopWebKit: false,
          isIPad: false,
        }),
        realMac: remap('MacIntel', {
          isWebKit: true,
          isDesktopWebKit: true,
          isIPad: false,
        }),
        android: remap('Linux armv8l', {
          isWebKit: false,
          isDesktopWebKit: false,
          isIPad: false,
        }),
        missing: remap('', {
          isWebKit: false,
          isDesktopWebKit: false,
          isIPad: false,
        }),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.native.length).toBeGreaterThan(0)
    expect(report.iPadDesktopMode).toBe('iPad')
    expect(report.iPhoneDesktopMode).toBe('iPhone')
    expect(report.realMac).toBe('MacIntel')
    expect(report.android).toBe('Linux armv8l')
    expect(report.missing).toBe('')
    expect(report.hostRtl).toBe('rtl')
  })
})
