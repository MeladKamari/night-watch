import {
  UnsupportedEnvironmentError,
  isAndroid,
  isBrowserEnvironment,
  isChromium,
  isChromium128OrNewer,
  isWebKit,
  withIframe,
  type BuiltinSourceOptions,
  type MaybePromise,
  type Source,
} from '@night-watch/core'

/**
 * Stable Latin probe string (max-width glyphs + ligatures).
 * Locked to FingerprintJS OSS v5.3.0 — do not swap for Persian samples in the hashed path.
 */
export const FONT_PREFERENCES_DEFAULT_TEXT = 'mmMwWLliI0fiflO&1'

/** Viewport srcdoc used so Android Firefox inherits system font sizing. */
export const FONT_PREFERENCES_IFRAME_HTML =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'

type PresetStyle = Partial<{
  font: string
  fontFamily: string
  fontSize: string
}>

type Preset = [style?: PresetStyle, text?: string]

/**
 * Text blocks to measure. Keys are persistent preset names (upstream order for Object.keys).
 */
export const FONT_PREFERENCE_PRESETS: Record<string, Preset> = {
  default: [],
  apple: [{ font: '-apple-system-body' }],
  serif: [{ fontFamily: 'serif' }],
  sans: [{ fontFamily: 'sans-serif' }],
  mono: [{ fontFamily: 'monospace' }],
  min: [{ fontSize: '1px' }],
  system: [{ fontFamily: 'system-ui' }],
}

export type FontPreferencesResult = Record<string, number>

/**
 * Floor measurements to reduce float noise.
 * Android → whole pixels; elsewhere → 3 decimal places.
 */
export function normalizeFontMeasurement(value: number, android = isAndroid()): number {
  const decimals = android ? 0 : 3
  const pow = 10 ** decimals
  return Math.floor(value * pow) / pow
}

export type MeasureFontPreferencesOptions = {
  presets?: Record<string, Preset>
  defaultText?: string
  /** When true, apply Chromium 128+ DPR normalization (tests can force). */
  normalizeForChromium128?: boolean
  isAndroidEnv?: boolean
  devicePixelRatio?: number
}

/**
 * Measures preset widths inside an already-prepared natural-font container.
 * Does not create/destroy the iframe — caller owns lifecycle.
 */
export function measureFontPreferencesInContainer(
  document: Document,
  container: HTMLElement,
  options: MeasureFontPreferencesOptions = {},
): FontPreferencesResult {
  const presets = options.presets ?? FONT_PREFERENCE_PRESETS
  const defaultText = options.defaultText ?? FONT_PREFERENCES_DEFAULT_TEXT
  const dpr = options.devicePixelRatio ?? 1
  const shouldNormalize =
    options.normalizeForChromium128 ?? (isChromium() && isChromium128OrNewer())
  const android = options.isAndroidEnv ?? isAndroid()

  const elements: Record<string, HTMLElement> = {}
  const sizes: FontPreferencesResult = {}

  for (const key of Object.keys(presets)) {
    const preset = presets[key]!
    const style = preset[0] ?? {}
    const text = preset[1] ?? defaultText

    const element = document.createElement('span')
    element.textContent = text
    element.style.whiteSpace = 'nowrap'

    for (const name of Object.keys(style) as Array<keyof PresetStyle>) {
      const value = style[name]
      if (value !== undefined) {
        element.style[name] = value
      }
    }

    elements[key] = element
    container.append(document.createElement('br'), element)
  }

  for (const key of Object.keys(presets)) {
    const rawWidth = elements[key]!.getBoundingClientRect().width
    sizes[key] = shouldNormalize
      ? normalizeFontMeasurement(rawWidth * dpr, android)
      : rawWidth
  }

  return sizes
}

/**
 * DOM environment with natural fonts (incl. Android OS sizing) and zoom handling.
 * Measurements stay inside the iframe; host layout is not mutated beyond a temporary iframe.
 */
export function withNaturalFonts<T>(
  action: (document: Document, container: HTMLElement, iframeWindow: Window) => MaybePromise<T>,
  containerWidthPx = 4000,
  iframeOptions?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  return withIframe((_, iframeWindow) => {
    const iframeDocument = iframeWindow.document
    const iframeBody = iframeDocument.body
    if (!iframeBody) {
      throw new TypeError('iframe body is unavailable for font preference measurement')
    }

    const bodyStyle = iframeBody.style
    bodyStyle.width = `${containerWidthPx}px`
    // textSizeAdjust: none — avoid Desktop-site scaling on Android Chrome.
    const styleWithTextSize = bodyStyle as CSSStyleDeclaration & {
      webkitTextSizeAdjust?: string
      textSizeAdjust?: string
      zoom?: string
    }
    styleWithTextSize.webkitTextSizeAdjust = 'none'
    styleWithTextSize.textSizeAdjust = 'none'

    if (isChromium()) {
      styleWithTextSize.zoom = `${1 / iframeWindow.devicePixelRatio}`
    } else if (isWebKit()) {
      styleWithTextSize.zoom = 'reset'
    }

    const linesOfText = iframeDocument.createElement('div')
    linesOfText.textContent = [...Array((containerWidthPx / 20) << 0)].map(() => 'word').join(' ')
    iframeBody.appendChild(linesOfText)

    return action(iframeDocument, iframeBody, iframeWindow)
  }, {
    initialHtml: FONT_PREFERENCES_IFRAME_HTML,
    ...iframeOptions,
  })
}

/**
 * Entropy source: widths of preset font samples in a natural-font iframe.
 */
export async function collectFontPreferences(
  options: { signal?: AbortSignal } = {},
): Promise<FontPreferencesResult> {
  if (!isBrowserEnvironment()) {
    throw new UnsupportedEnvironmentError('Browser environment is required for fontPreferences')
  }

  return withNaturalFonts(
    (document, container, iframeWindow) =>
      measureFontPreferencesInContainer(document, container, {
        devicePixelRatio: iframeWindow.devicePixelRatio,
      }),
    4000,
    options.signal ? { signal: options.signal } : undefined,
  )
}

export const getFontPreferences: Source<BuiltinSourceOptions, FontPreferencesResult> = (options) =>
  collectFontPreferences(options.signal ? { signal: options.signal } : {})
