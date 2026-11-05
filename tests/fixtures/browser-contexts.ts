import type { BrowserContext } from '@night-watch/core'

type LooseWindow = Record<string, unknown> & {
  Intl?: unknown
  Reflect?: unknown
  CSS?: { supports?: (...args: unknown[]) => boolean }
  HTMLElement?: { prototype: object }
  Document?: { prototype: object }
  HTMLButtonElement?: { prototype: object }
  AudioContext?: { prototype: object }
  Promise?: object
  print?: (...args: unknown[]) => unknown
  browser?: unknown
  visualViewport?: object
}

function baseDocument(): Document {
  return {
    documentElement: { style: {} },
  } as unknown as Document
}

function baseScreen(width = 1920, height = 1080): Screen {
  return { width, height } as Screen
}

/** Chromium-like capability fixture (not UA-driven). */
export function chromiumContext(
  extras: { navigator?: Partial<Navigator>; window?: LooseWindow } = {},
): BrowserContext {
  const windowBag: LooseWindow = {
    webkitResolveLocalFileSystemURL: () => undefined,
    BatteryManager: function BatteryManager() {},
    webkitMediaStream: function MediaStream() {},
    webkitSpeechGrammar: function SpeechGrammar() {},
    Intl: {},
    Reflect: {},
    CSS: { supports: () => false },
    ...extras.window,
  }
  // Stringify tags used by isChromium86OrNewer
  Object.defineProperty(windowBag, 'Intl', {
    value: windowBag.Intl,
    configurable: true,
  })
  return {
    window: windowBag as unknown as Window,
    navigator: {
      vendor: 'Google Inc.',
      webkitPersistentStorage: {},
      webkitTemporaryStorage: {},
      platform: 'Win32',
      appVersion: '5.0',
      userAgent: 'Mozilla/5.0 (compatible; SpoofedFirefox/120.0)',
      ...extras.navigator,
    } as unknown as Navigator,
    document: baseDocument(),
    screen: baseScreen(),
  }
}

/** Gecko-like capability fixture. */
export function geckoContext(
  extras: { navigator?: Partial<Navigator>; window?: LooseWindow } = {},
): BrowserContext {
  const style = { MozAppearance: '' } as CSSStyleDeclaration
  return {
    window: {
      onmozfullscreenchange: null,
      mozInnerScreenX: 0,
      CSSMozDocumentRule: function CSSMozDocumentRule() {},
      CanvasCaptureMediaStream: function CanvasCaptureMediaStream() {},
      CSS: { supports: () => false },
      ...extras.window,
    } as unknown as Window,
    navigator: {
      vendor: '',
      buildID: '20240101000000',
      platform: 'Linux x86_64',
      appVersion: '5.0 (X11)',
      userAgent: 'Mozilla/5.0 (compatible; SpoofedChrome/120.0)',
      ...extras.navigator,
    } as unknown as Navigator,
    document: { documentElement: { style } } as unknown as Document,
    screen: baseScreen(),
  }
}

/** WebKit / iOS-like capability fixture (ApplePayError is engine signature only). */
export function webKitContext(
  extras: {
    navigator?: Partial<Navigator>
    window?: LooseWindow
    desktop?: boolean
  } = {},
): BrowserContext {
  const desktop = extras.desktop === true
  return {
    window: {
      ApplePayError: function ApplePayError() {},
      CSSPrimitiveValue: function CSSPrimitiveValue() {},
      Counter: function Counter() {},
      RGBColor: function RGBColor() {},
      WebKitMediaKeys: function WebKitMediaKeys() {},
      ...(desktop
        ? {
            safari: {},
            Document: { prototype: { pointerLockElement: null } },
            HTMLElement: { prototype: {} },
          }
        : {
            ongestureend: null,
            TouchEvent: function TouchEvent() {},
            orientation: 0,
          }),
      CSS: {
        supports: (query: string) =>
          query.includes('font-size-adjust') || query.includes('text-transform'),
      },
      HTMLButtonElement: { prototype: { popover: null } },
      print: () => undefined,
      ...extras.window,
    } as unknown as Window,
    navigator: {
      vendor: 'Apple Computer, Inc.',
      platform: desktop ? 'MacIntel' : 'iPhone',
      appVersion: '5.0',
      userAgent: 'Mozilla/5.0 (compatible; SpoofedGecko/120.0)',
      ...extras.navigator,
    } as unknown as Navigator,
    document: baseDocument(),
    screen: baseScreen(desktop ? 1440 : 390, desktop ? 900 : 844),
  }
}

/** Trident-like fixture. */
export function tridentContext(): BrowserContext {
  return {
    window: {
      MSCSSMatrix: function MSCSSMatrix() {},
      msSetImmediate: () => 0,
      msIndexedDB: {},
    } as unknown as Window,
    navigator: {
      vendor: '',
      msMaxTouchPoints: 0,
      msPointerEnabled: true,
      platform: 'Win32',
      appVersion: '5.0',
      userAgent: 'Mozilla/5.0 (compatible; SpoofedChrome/99.0)',
    } as unknown as Navigator,
    document: baseDocument(),
    screen: baseScreen(),
  }
}

/** EdgeHTML-like fixture (not Trident). */
export function edgeHtmlContext(): BrowserContext {
  return {
    window: {
      msWriteProfilerMark: () => undefined,
      MSStream: {},
    } as unknown as Window,
    navigator: {
      vendor: '',
      msLaunchUri: () => undefined,
      msSaveBlob: () => true,
      platform: 'Win32',
      appVersion: '5.0',
      userAgent: 'Mozilla/5.0 (compatible; SpoofedSafari/15.0)',
    } as unknown as Navigator,
    document: baseDocument(),
    screen: baseScreen(),
  }
}
