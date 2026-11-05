import {
  detectConfidenceEnvironmentHints,
  getBrowserContext,
  getConfidence,
  HEURISTIC_SCORES,
  isAndroid,
  isChromium,
  isDesktopWebKit,
  isEdgeHTML,
  isGecko,
  isIPad,
  isSafariWebKit,
  isSamsungInternet,
  isTrident,
  isWebKit,
  isWebKit616OrNewer,
} from '@night-watch/core'
import { describe, expect, it } from 'vitest'
import {
  chromiumContext,
  edgeHtmlContext,
  geckoContext,
  tridentContext,
  webKitContext,
} from './fixtures/browser-contexts.js'

function platform(value: string) {
  return { platform: { value, duration: 1 } }
}

describe('browser engine detectors (Node / fixtures)', () => {
  it('returns false for all detectors when no browser context exists', () => {
    expect(getBrowserContext()).toBeUndefined()
    expect(isChromium()).toBe(false)
    expect(isWebKit()).toBe(false)
    expect(isGecko()).toBe(false)
    expect(isTrident()).toBe(false)
    expect(isEdgeHTML()).toBe(false)
    expect(isAndroid()).toBe(false)
    expect(isSamsungInternet()).toBe(false)
    expect(isIPad()).toBe(false)
    expect(isDesktopWebKit()).toBe(false)
    expect(isSafariWebKit()).toBe(false)
    expect(detectConfidenceEnvironmentHints()).toEqual({
      isAndroid: false,
      isWebKit: false,
      isDesktopWebKit: false,
      isWebKit616OrNewer: false,
      isSafariWebKit: false,
    })
  })

  it('detects Chromium from capabilities even when UA claims Firefox', () => {
    const ctx = chromiumContext()
    expect(isChromium(ctx)).toBe(true)
    expect(isGecko(ctx)).toBe(false)
    expect(isWebKit(ctx)).toBe(false)
    expect(ctx.navigator.userAgent).toMatch(/SpoofedFirefox/)
  })

  it('detects Gecko from capabilities even when UA claims Chrome', () => {
    const ctx = geckoContext()
    expect(isGecko(ctx)).toBe(true)
    expect(isChromium(ctx)).toBe(false)
    expect(ctx.navigator.userAgent).toMatch(/SpoofedChrome/)
  })

  it('detects WebKit from capabilities even when UA claims Gecko', () => {
    const ctx = webKitContext()
    expect(isWebKit(ctx)).toBe(true)
    expect(isChromium(ctx)).toBe(false)
    expect(isGecko(ctx)).toBe(false)
    expect(ctx.navigator.userAgent).toMatch(/SpoofedGecko/)
  })

  it('detects Trident and EdgeHTML without trusting UA', () => {
    expect(isTrident(tridentContext())).toBe(true)
    expect(isEdgeHTML(edgeHtmlContext())).toBe(true)
    expect(isTrident(edgeHtmlContext())).toBe(false)
  })

  it('treats desktop WebKit separately from mobile WebKit', () => {
    const mobile = webKitContext()
    const desktop = webKitContext({ desktop: true })
    expect(isWebKit(mobile)).toBe(true)
    expect(isDesktopWebKit(mobile)).toBe(false)
    expect(isWebKit(desktop)).toBe(true)
    expect(isDesktopWebKit(desktop)).toBe(true)
  })

  it('does not treat ApplePayError presence as an applePay entropy source', () => {
    const ctx = webKitContext()
    expect('ApplePayError' in ctx.window).toBe(true)
    // Engine signature only — confidence hints must not invent payment collection.
    const hints = detectConfidenceEnvironmentHints(ctx)
    expect(hints.isWebKit).toBe(true)
    expect(Object.keys(hints)).not.toContain('applePay')
  })

  it('flags Android Chromium via capability mix, not UA brand alone', () => {
    const ctx = chromiumContext({
      navigator: {
        vendor: 'Google Inc.',
        platform: 'Linux armv8l',
        appVersion: '5.0 (Linux; Android 13)',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) SpoofedDesktop',
      } as Partial<Navigator>,
      window: {
        HTMLInputElement: { prototype: { capture: null } },
        NetworkInformation: { prototype: { ontypechange: null } },
        Intl: {
          supportedValuesOf: (key: string) => (key === 'collation' ? ['dict'] : []),
        },
      },
    })
    // Audio() may be missing under Node → need at least 2 of the Chromium-Android signals.
    expect(isChromium(ctx)).toBe(true)
    expect(isAndroid(ctx)).toBe(true)
  })

  it('flags Android Gecko via orientation + appVersion, ignoring Chrome UA spoof', () => {
    const ctx = geckoContext({
      navigator: {
        buildID: '20240101000000',
        appVersion: '5.0 (Android 12)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) SpoofedChrome/120',
      } as Partial<Navigator>,
      window: {
        onorientationchange: null,
        orientation: 0,
      },
    })
    expect(isGecko(ctx)).toBe(true)
    expect(isAndroid(ctx)).toBe(true)
  })

  it('detects iPad via platform or MediaSource + aspect heuristic', () => {
    expect(
      isIPad(
        webKitContext({
          navigator: { vendor: 'Apple Computer, Inc.', platform: 'iPad' } as Partial<Navigator>,
        }),
      ),
    ).toBe(true)

    const almostSquare = webKitContext({
      navigator: { vendor: 'Apple Computer, Inc.', platform: 'MacIntel' } as Partial<Navigator>,
    })
    // Inject MediaSource + square-ish screen (Element.webkitRequestFullscreen may be absent on Node).
    ;(almostSquare.window as unknown as Record<string, unknown>).MediaSource = function MediaSource() {}
    Object.defineProperty(almostSquare, 'screen', {
      value: { width: 1024, height: 768 },
    })
    // Without webkitRequestFullscreen on Node, need MediaSource + ratio only (>=2).
    expect(isIPad(almostSquare)).toBe(true)
  })

  it('does not claim Samsung Internet from a bare Chromium fixture', () => {
    expect(isSamsungInternet(chromiumContext())).toBe(false)
  })

  it('isSafariWebKit stays false for non-native print (fixture / Node)', () => {
    const ctx = webKitContext({
      window: {
        print: () => undefined, // non-native string form
        browser: '[object WebPageNamespace]',
      },
    })
    expect(isSafariWebKit(ctx)).toBe(false)
  })

  it('wires live detector hints into getConfidence (overrides still win)', () => {
    // Under Node, live hints are all false → platform path.
    expect(getConfidence(platform('Win32')).score).toBe(HEURISTIC_SCORES.windows)

    const webkitHints = detectConfidenceEnvironmentHints(webKitContext())
    expect(webkitHints.isWebKit).toBe(true)
    expect(
      getConfidence(platform('iPhone'), { environment: webkitHints }).score,
    ).toBe(HEURISTIC_SCORES.webkitMobileOrModernSafari)

    expect(
      getConfidence(platform('Linux armv8l'), { environment: { isAndroid: true } }).score,
    ).toBe(HEURISTIC_SCORES.android)
  })

  it('WebKit 616 gate uses CSS/popover capabilities when present', () => {
    const ctx = webKitContext({
      navigator: {
        vendor: 'Apple Computer, Inc.',
        // getStorageUpdates absent → truthy for !('getStorageUpdates' in n)
      } as Partial<Navigator>,
    })
    expect(isWebKit616OrNewer(ctx)).toBe(true)
  })
})
