import { expect, test } from '@playwright/test'
import {
  detectConfidenceEnvironmentHints,
  isAndroid,
  isChromium,
  isGecko,
  isTrident,
  isWebKit,
} from '@night-watch/core'

/**
 * Chromium capability smoke. Full in-page `@night-watch/core` import awaits playground bundling;
 * here we assert Playwright Desktop Chrome exposes the same signature family our detectors use.
 * Node-side package calls must remain SSR-safe (false / empty).
 */
test.describe('browser engine capability signatures', () => {
  test('Desktop Chrome looks Chromium-like by capabilities, not UA brand alone', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body><p id="ok">ready</p></body></html>')
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(() => {
      const w = window as Window & Record<string, unknown>
      const n = navigator as Navigator & Record<string, unknown>
      const chromiumSignals = [
        'webkitPersistentStorage' in n,
        'webkitTemporaryStorage' in n,
        (n.vendor || '').indexOf('Google') === 0,
        'webkitResolveLocalFileSystemURL' in w,
        'BatteryManager' in w,
        'webkitMediaStream' in w,
        'webkitSpeechGrammar' in w,
      ]
      const geckoSignals = [
        'buildID' in n,
        'MozAppearance' in (document.documentElement?.style ?? {}),
        'onmozfullscreenchange' in w,
        'mozInnerScreenX' in w,
        'CSSMozDocumentRule' in w,
        'CanvasCaptureMediaStream' in w,
      ]
      const webKitSignals = [
        'ApplePayError' in w,
        'CSSPrimitiveValue' in w,
        'Counter' in w,
        n.vendor.indexOf('Apple') === 0,
        'RGBColor' in w,
        'WebKitMediaKeys' in w,
      ]
      const truthy = (xs: boolean[]) => xs.filter(Boolean).length
      return {
        userAgent: n.userAgent,
        chromiumCount: truthy(chromiumSignals),
        geckoCount: truthy(geckoSignals),
        webKitCount: truthy(webKitSignals),
        vendor: n.vendor,
      }
    })

    // Thresholds match packages/core/src/browser/engines.ts
    expect(report.chromiumCount).toBeGreaterThanOrEqual(5)
    expect(report.geckoCount).toBeLessThan(4)
    expect(report.webKitCount).toBeLessThan(4)

    // Package detectors under the Playwright Node worker stay SSR-safe.
    expect(isChromium()).toBe(false)
    expect(isGecko()).toBe(false)
    expect(isWebKit()).toBe(false)
    expect(isTrident()).toBe(false)
    expect(isAndroid()).toBe(false)
    expect(detectConfidenceEnvironmentHints()).toEqual({
      isAndroid: false,
      isWebKit: false,
      isDesktopWebKit: false,
      isWebKit616OrNewer: false,
      isSafariWebKit: false,
    })
  })

  test('spoofed navigator.userAgent alone must not flip engine family in-page', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const w = window as Window & Record<string, unknown>
      const n = navigator as Navigator & Record<string, unknown>
      Object.defineProperty(n, 'userAgent', {
        configurable: true,
        get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Gecko/20100101 Firefox/120.0',
      })
      const chromiumSignals = [
        'webkitPersistentStorage' in n,
        'webkitTemporaryStorage' in n,
        (n.vendor || '').indexOf('Google') === 0,
        'webkitResolveLocalFileSystemURL' in w,
        'BatteryManager' in w,
        'webkitMediaStream' in w,
        'webkitSpeechGrammar' in w,
      ]
      return {
        spoofedUa: n.userAgent,
        chromiumCount: chromiumSignals.filter(Boolean).length,
      }
    })

    expect(report.spoofedUa).toMatch(/Firefox/)
    expect(report.chromiumCount).toBeGreaterThanOrEqual(5)
  })
})
