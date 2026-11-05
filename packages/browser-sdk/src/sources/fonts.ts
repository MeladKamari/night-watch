import {
  UnsupportedEnvironmentError,
  isBrowserEnvironment,
  withIframe,
  type BuiltinSourceOptions,
  type Source,
} from '@night-watch/core'

/**
 * Probe string: `m`/`w` maximize width; `LLi` separates otherwise-similar fonts.
 * Locked to FingerprintJS OSS v5.3.0 `fonts.ts`.
 */
export const FONT_PROBE_STRING = 'mmMwWLliI0O&1'

/** Probe font size (larger tends to amplify width/height deltas). */
export const FONT_PROBE_SIZE = '48px'

/** Generic families each candidate is compared against. */
export const FONT_BASE_FAMILIES = ['monospace', 'sans-serif', 'serif'] as const

/**
 * Default candidate list — identical to pinned upstream v5.3.0.
 * Persian fonts (Vazirmatn, B Nazanin, …) are NOT added here; see ADR-025 / D-017
 * for an opt-in, separately versioned extension proposal only.
 */
export const FONT_CANDIDATE_LIST = [
  'sans-serif-thin',
  'ARNO PRO',
  'Agency FB',
  'Arabic Typesetting',
  'Arial Unicode MS',
  'AvantGarde Bk BT',
  'BankGothic Md BT',
  'Batang',
  'Bitstream Vera Sans Mono',
  'Calibri',
  'Century',
  'Century Gothic',
  'Clarendon',
  'EUROSTILE',
  'Franklin Gothic',
  'Futura Bk BT',
  'Futura Md BT',
  'GOTHAM',
  'Gill Sans',
  'HELV',
  'Haettenschweiler',
  'Helvetica Neue',
  'Humanst521 BT',
  'Leelawadee',
  'Letter Gothic',
  'Levenim MT',
  'Lucida Bright',
  'Lucida Sans',
  'Menlo',
  'MS Mincho',
  'MS Outlook',
  'MS Reference Specialty',
  'MS UI Gothic',
  'MT Extra',
  'MYRIAD PRO',
  'Marlett',
  'Meiryo UI',
  'Microsoft Uighur',
  'Minion Pro',
  'Monotype Corsiva',
  'PMingLiU',
  'Pristina',
  'SCRIPTINA',
  'Segoe UI Light',
  'Serifa',
  'SimHei',
  'Small Fonts',
  'Staccato222 BT',
  'TRAJAN PRO',
  'Univers CE 55 Medium',
  'Vrinda',
  'ZWAdobeF',
] as const

export type FontBaseFamily = (typeof FONT_BASE_FAMILIES)[number]
export type FontCandidateName = (typeof FONT_CANDIDATE_LIST)[number]

export type FontProbeOptions = {
  testString?: string
  textSize?: string
  baseFonts?: readonly string[]
  fontList?: readonly string[]
}

/**
 * Measures which fonts from `fontList` alter layout vs base families inside `document`.
 * Does not call Local Font Access API / `queryLocalFonts`.
 * Caller owns the document lifetime (iframe body or test fixture).
 */
export function probeFontsInDocument(document: Document, options: FontProbeOptions = {}): string[] {
  const testString = options.testString ?? FONT_PROBE_STRING
  const textSize = options.textSize ?? FONT_PROBE_SIZE
  const baseFonts = options.baseFonts ?? FONT_BASE_FAMILIES
  const fontList = options.fontList ?? FONT_CANDIDATE_LIST

  const holder = document.body
  if (!holder) {
    throw new TypeError('document.body is required for font probing')
  }
  holder.style.fontSize = textSize

  const spansContainer = document.createElement('div')
  spansContainer.style.setProperty('visibility', 'hidden', 'important')

  const defaultWidth: Record<string, number> = {}
  const defaultHeight: Record<string, number> = {}

  const createSpan = (fontFamily: string): HTMLSpanElement => {
    const span = document.createElement('span')
    const { style } = span
    style.position = 'absolute'
    style.top = '0'
    style.left = '0'
    style.fontFamily = fontFamily
    span.textContent = testString
    spansContainer.appendChild(span)
    return span
  }

  const createSpanWithFonts = (fontToDetect: string, baseFont: string) =>
    createSpan(`'${fontToDetect}',${baseFont}`)

  const baseFontsSpans = baseFonts.map((base) => createSpan(base))
  const fontsSpans: Record<string, HTMLSpanElement[]> = {}
  for (const font of fontList) {
    fontsSpans[font] = baseFonts.map((baseFont) => createSpanWithFonts(font, baseFont))
  }

  holder.appendChild(spansContainer)

  for (let index = 0; index < baseFonts.length; index++) {
    const base = baseFonts[index]!
    defaultWidth[base] = baseFontsSpans[index]!.offsetWidth
    defaultHeight[base] = baseFontsSpans[index]!.offsetHeight
  }

  const isFontAvailable = (fontSpans: HTMLElement[]) =>
    baseFonts.some(
      (baseFont, baseFontIndex) =>
        fontSpans[baseFontIndex]!.offsetWidth !== defaultWidth[baseFont] ||
        fontSpans[baseFontIndex]!.offsetHeight !== defaultHeight[baseFont],
    )

  return fontList.filter((font) => isFontAvailable(fontsSpans[font]!))
}

/**
 * Entropy source: installed font availability via CSS layout deltas in an isolated iframe.
 * Returns a stable ordered subset of {@link FONT_CANDIDATE_LIST}.
 */
export const getFonts: Source<BuiltinSourceOptions, string[]> = (options) => {
  if (!isBrowserEnvironment()) {
    return Promise.reject(
      new UnsupportedEnvironmentError('Browser environment is required for fonts'),
    )
  }

  const iframeOptions = options.signal ? { signal: options.signal } : undefined
  return withIframe(
    (_iframe, iWindow) => probeFontsInDocument(iWindow.document),
    iframeOptions,
  )
}
