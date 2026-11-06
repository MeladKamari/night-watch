import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * CSS `forced-colors` media feature (e.g. Windows High Contrast).
 * Tri-state: `true` (active), `false` (none), `undefined` (unsupported / unidentified).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
 */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type ForcedColorsOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Reads `(forced-colors: active|none)`.
 * Missing matchMedia or neither value matching → `undefined` (never invent `false`).
 */
export function getForcedColorsValue(options: ForcedColorsOptions = {}): boolean | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectForcedColors(matchMedia)
}

export function detectForcedColors(matchMedia: MatchMediaLike): boolean | undefined {
  if (doesMatch(matchMedia, 'active')) {
    return true
  }
  if (doesMatch(matchMedia, 'none')) {
    return false
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(forced-colors: ${value})`).matches
}

function resolveMatchMedia(options: ForcedColorsOptions): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: forced-colors mode (tri-state boolean | undefined). */
export const getForcedColors: Source<BuiltinSourceOptions, boolean | undefined> = () =>
  getForcedColorsValue()
