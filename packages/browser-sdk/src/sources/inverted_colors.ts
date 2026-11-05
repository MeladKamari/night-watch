import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * CSS `inverted-colors` media feature.
 * Tri-state: `true` (inverted), `false` (none), `undefined` (unsupported / unidentified).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/inverted-colors
 */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type InvertedColorsOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Reads `(inverted-colors: inverted|none)`.
 * Missing matchMedia or neither value matching → `undefined` (never invent `false`).
 */
export function getInvertedColorsValue(
  options: InvertedColorsOptions = {},
): boolean | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectInvertedColors(matchMedia)
}

export function detectInvertedColors(matchMedia: MatchMediaLike): boolean | undefined {
  if (doesMatch(matchMedia, 'inverted')) {
    return true
  }
  if (doesMatch(matchMedia, 'none')) {
    return false
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(inverted-colors: ${value})`).matches
}

function resolveMatchMedia(
  options: InvertedColorsOptions,
): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: inverted-colors preference (tri-state boolean | undefined). */
export const getInvertedColors: Source<BuiltinSourceOptions, boolean | undefined> = () =>
  getInvertedColorsValue()
