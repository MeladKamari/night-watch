/*
 * Capability-signature browser detectors.
 * Observable behavior aligned with FingerprintJS OSS v5.3.0 `utils/browser.ts`.
 * Prefer feature probes over raw user-agent brand strings.
 */

import { countTruthy } from '../data/count-truthy.js'
import { isFunctionNative } from '../errors/native.js'
import { getBrowserContext, type BrowserContext } from './context.js'

/**
 * DOM constructors and helpers often appear as `window` properties at runtime.
 * TypeScript's `Window` typings omit many of these; detectors read them via this bag.
 */
type EngineWindow = Window &
  Record<string, unknown> & {
    HTMLElement?: typeof HTMLElement
    Document?: typeof Document
    HTMLButtonElement?: typeof HTMLButtonElement
    HTMLInputElement?: typeof HTMLInputElement
    CSS?: typeof CSS
    Intl?: typeof Intl
    Reflect?: typeof Reflect
    AudioContext?: typeof AudioContext
    Promise?: PromiseConstructor & { try?: unknown }
    URLPattern?: { prototype: object }
    NetworkInformation?: { prototype?: object }
    print?: (...args: unknown[]) => unknown
    browser?: unknown
    visualViewport?: VisualViewport
  }

function engineWindow(context: BrowserContext): EngineWindow {
  return context.window as EngineWindow
}

function ctx(explicit?: BrowserContext): BrowserContext | undefined {
  return explicit ?? getBrowserContext()
}

/** Trident (IE) without trusting UA. */
export function isTrident(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  return (
    countTruthy([
      'MSCSSMatrix' in w,
      'msSetImmediate' in w,
      'msIndexedDB' in w,
      'msMaxTouchPoints' in n,
      'msPointerEnabled' in n,
    ]) >= 4
  )
}

/** Pre-Chromium EdgeHTML without trusting UA. */
export function isEdgeHTML(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  return (
    countTruthy([
      'msWriteProfilerMark' in w,
      'MSStream' in w,
      'msLaunchUri' in n,
      'msSaveBlob' in n,
    ]) >= 3 && !isTrident(c)
  )
}

/** Chromium without trusting UA. */
export function isChromium(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  return (
    countTruthy([
      'webkitPersistentStorage' in n,
      'webkitTemporaryStorage' in n,
      (n.vendor || '').indexOf('Google') === 0,
      'webkitResolveLocalFileSystemURL' in w,
      'BatteryManager' in w,
      'webkitMediaStream' in w,
      'webkitSpeechGrammar' in w,
    ]) >= 5
  )
}

/**
 * WebKit (Safari engine / all iOS browsers) without trusting UA.
 * Note: `ApplePayError` presence is an engine signature only — this SDK does not
 * call Apple Pay APIs or register an `applePay` entropy source.
 */
export function isWebKit(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  return (
    countTruthy([
      'ApplePayError' in w,
      'CSSPrimitiveValue' in w,
      'Counter' in w,
      n.vendor.indexOf('Apple') === 0,
      'RGBColor' in w,
      'WebKitMediaKeys' in w,
    ]) >= 4
  )
}

/** Desktop WebKit (does not itself prove the engine is WebKit). */
export function isDesktopWebKit(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const { HTMLElement: WinHTMLElement, Document: WinDocument } = w
  return (
    countTruthy([
      'safari' in w,
      !('ongestureend' in w),
      !('TouchEvent' in w),
      !('orientation' in w),
      !!WinHTMLElement && !('autocapitalize' in WinHTMLElement.prototype),
      !!WinDocument && 'pointerLockElement' in WinDocument.prototype,
    ]) >= 4
  )
}

/**
 * Safari WebKit (works properly for Safari ≥ 15.4).
 * Does not itself prove the engine is WebKit.
 */
export function isSafariWebKit(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  if (typeof w.print !== 'function') {
    return false
  }
  return isFunctionNative(w.print) && String(w.browser) === '[object WebPageNamespace]'
}

/** Gecko (Firefox) without trusting UA. */
export function isGecko(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  return (
    countTruthy([
      'buildID' in c.navigator,
      'MozAppearance' in (c.document.documentElement?.style ?? {}),
      'onmozfullscreenchange' in w,
      'mozInnerScreenX' in w,
      'CSSMozDocumentRule' in w,
      'CanvasCaptureMediaStream' in w,
    ]) >= 4
  )
}

export function isGecko120OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  const { CSS: WinCSS } = w
  if (!WinCSS?.supports) {
    return false
  }
  return (
    countTruthy([
      'userActivation' in n,
      WinCSS.supports('color', 'light-dark(#000, #fff)'),
      WinCSS.supports('height', '1lh'),
      'globalPrivacyControl' in n,
    ]) >= 3
  )
}

export function isGecko143OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const { CSS: WinCSS } = engineWindow(c)
  if (!WinCSS?.supports) {
    return false
  }
  return (
    countTruthy([
      WinCSS.supports('selector(::details-content)'),
      WinCSS.supports('selector(::before::marker)'),
      WinCSS.supports('selector(::after::marker)'),
      typeof CompositionEvent !== 'undefined' && !('locale' in CompositionEvent.prototype),
    ]) >= 3
  )
}

export function isChromium86OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  return (
    countTruthy([
      !('MediaSettingsRange' in w),
      'RTCEncodedAudioFrame' in w,
      `${w.Intl}` === '[object Intl]',
      `${w.Reflect}` === '[object Reflect]',
    ]) >= 3
  )
}

export function isChromium122OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const { URLPattern } = w
  return (
    countTruthy([
      'union' in Set.prototype,
      'Iterator' in w,
      URLPattern && 'hasRegExpGroups' in URLPattern.prototype,
      typeof WebGLRenderingContext !== 'undefined' &&
        'RGB8' in WebGLRenderingContext.prototype,
    ]) >= 3
  )
}

export function isChromium128OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const d = c.document
  const { CSS: WinCSS, Promise: PromiseCtor, AudioContext: WinAudioContext } = w
  if (!WinCSS?.supports) {
    return false
  }
  return (
    countTruthy([
      PromiseCtor && 'try' in PromiseCtor,
      'caretPositionFromPoint' in d,
      WinAudioContext && 'onerror' in WinAudioContext.prototype,
      WinCSS.supports('ruby-align', 'space-around'),
    ]) >= 3
  )
}

export function isWebKit606OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  return (
    countTruthy([
      'DOMRectList' in w,
      'RTCPeerConnectionIceEvent' in w,
      'SVGGeometryElement' in w,
      'ontransitioncancel' in w,
    ]) >= 3
  )
}

export function isWebKit616OrNewer(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const w = engineWindow(c)
  const n = c.navigator
  const { CSS: WinCSS, HTMLButtonElement: WinHTMLButtonElement } = w
  if (!WinCSS?.supports) {
    return false
  }
  return (
    countTruthy([
      !('getStorageUpdates' in n),
      WinHTMLButtonElement && 'popover' in WinHTMLButtonElement.prototype,
      'CSSCounterStyleRule' in w,
      WinCSS.supports('font-size-adjust: ex-height 0.5'),
      WinCSS.supports('text-transform: full-width'),
    ]) >= 4
  )
}

export function isIPad(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  if (c.navigator.platform === 'iPad') {
    return true
  }
  const s = c.screen
  const screenRatio = s.width / s.height
  const hasWebkitFullscreen =
    typeof Element !== 'undefined' &&
    !!(Element.prototype as Element & { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen
  return (
    countTruthy([
      'MediaSource' in c.window,
      hasWebkitFullscreen,
      screenRatio > 0.65 && screenRatio < 1.53,
    ]) >= 2
  )
}

function hasDictCollation(context: BrowserContext): boolean {
  try {
    const intl = engineWindow(context).Intl as
      | (typeof Intl & { supportedValuesOf?: (key: string) => string[] })
      | undefined
    return !!intl?.supportedValuesOf?.('collation').includes('dict')
  } catch {
    return false
  }
}

/** Android without trusting UA (Chromium / Gecko paths). */
export function isAndroid(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const isItChromium = isChromium(c)
  const isItGecko = isGecko(c)
  const w = engineWindow(c)
  const n = c.navigator

  if (isItChromium) {
    const inputProto = w.HTMLInputElement?.prototype
    return (
      countTruthy([
        hasDictCollation(c),
        !!inputProto && 'capture' in inputProto,
        'NetworkInformation' in w &&
          'ontypechange' in (w.NetworkInformation?.prototype ?? {}),
        typeof Audio !== 'undefined' && !('sinkId' in new Audio()),
      ]) >= 2
    )
  }

  if (isItGecko) {
    return countTruthy(['onorientationchange' in w, 'orientation' in w, /android/i.test(n.appVersion)]) >= 2
  }

  return false
}

/**
 * Samsung Internet (call after {@link isChromium}).
 * Capability signatures — not UA brand alone.
 */
export function isSamsungInternet(context?: BrowserContext): boolean {
  const c = ctx(context)
  if (!c) {
    return false
  }
  const n = c.navigator
  const w = engineWindow(c)
  if (typeof Audio === 'undefined' || typeof Image === 'undefined') {
    return false
  }
  const audioPrototype = Audio.prototype as typeof Audio.prototype & {
    srLatency?: unknown
    srChannelCount?: unknown
  }
  const { visualViewport } = w
  return (
    countTruthy([
      'srLatency' in audioPrototype,
      'srChannelCount' in audioPrototype,
      'devicePosture' in n,
      visualViewport && 'segments' in visualViewport,
      'getTextInformation' in Image.prototype,
    ]) >= 3
  )
}

export function getFullscreenElement(context?: BrowserContext): Element | null {
  const c = ctx(context)
  if (!c) {
    return null
  }
  const d = c.document as Document & {
    msFullscreenElement?: Element | null
    mozFullScreenElement?: Element | null
    webkitFullscreenElement?: Element | null
  }
  return (
    d.fullscreenElement ||
    d.msFullscreenElement ||
    d.mozFullScreenElement ||
    d.webkitFullscreenElement ||
    null
  )
}

export function exitFullscreen(context?: BrowserContext): Promise<void> {
  const c = ctx(context)
  if (!c) {
    return Promise.reject(new TypeError('Fullscreen API is unavailable'))
  }
  const d = c.document as Document & {
    msExitFullscreen?: () => Promise<void> | void
    mozCancelFullScreen?: () => Promise<void> | void
    webkitExitFullscreen?: () => Promise<void> | void
  }
  const exit =
    d.exitFullscreen || d.msExitFullscreen || d.mozCancelFullScreen || d.webkitExitFullscreen
  if (typeof exit !== 'function') {
    return Promise.reject(new TypeError('Fullscreen exit is unavailable'))
  }
  return Promise.resolve(exit.call(d)).then(() => undefined)
}
