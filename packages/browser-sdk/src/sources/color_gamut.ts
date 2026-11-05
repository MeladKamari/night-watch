import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * CSS `color-gamut` media feature values.
 * Wider gamuts include narrower ones (rec2020 ⊃ p3 ⊃ srgb), so probe widest-first.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/color-gamut
 */
export type ColorGamut = 'srgb' | 'p3' | 'rec2020'

/** Probe order: widest first so the most capable matching gamut wins. */
export const COLOR_GAMUT_ORDER = ['rec2020', 'p3', 'srgb'] as const

/** Minimal matchMedia surface (`.matches` only). */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type ColorGamutOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Detects display color gamut via `(color-gamut: …)` media queries.
 * Returns `undefined` when matchMedia is absent or no gamut matches (never invents `srgb`).
 */
export function getColorGamutValue(options: ColorGamutOptions = {}): ColorGamut | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectColorGamut(matchMedia)
}

export function detectColorGamut(matchMedia: MatchMediaLike): ColorGamut | undefined {
  for (const gamut of COLOR_GAMUT_ORDER) {
    if (matchMedia(`(color-gamut: ${gamut})`).matches) {
      return gamut
    }
  }
  return undefined
}

function resolveMatchMedia(options: ColorGamutOptions): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: CSS color-gamut capability (`undefined` when unidentified). */
export const getColorGamut: Source<BuiltinSourceOptions, ColorGamut | undefined> = () =>
  getColorGamutValue()
