import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * Stable numeric codes for `prefers-contrast` (FingerprintJS OSS v5.3.0).
 * These are successful component **values**, not `{ error }`.
 *
 * @see https://www.w3.org/TR/mediaqueries-5/#prefers-contrast
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
 */
export const ContrastPreference = {
  Less: -1,
  None: 0,
  More: 1,
  // "Max" can be added in future
  ForcedColors: 10,
} as const

export type ContrastPreferenceCode =
  (typeof ContrastPreference)[keyof typeof ContrastPreference]

export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type ContrastOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Maps `prefers-contrast` keywords to stable numeric states.
 * Unsupported / missing matchMedia → `undefined` (never invent `None`).
 *
 * Keyword aliases: `high`≡`more`, `low`≡`less` (sources historically disagree).
 */
export function getContrastValue(
  options: ContrastOptions = {},
): ContrastPreferenceCode | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectContrastPreference(matchMedia)
}

export function detectContrastPreference(
  matchMedia: MatchMediaLike,
): ContrastPreferenceCode | undefined {
  if (doesMatch(matchMedia, 'no-preference')) {
    return ContrastPreference.None
  }
  // Sources contradict on keywords; check both until all browsers settle.
  if (doesMatch(matchMedia, 'high') || doesMatch(matchMedia, 'more')) {
    return ContrastPreference.More
  }
  if (doesMatch(matchMedia, 'low') || doesMatch(matchMedia, 'less')) {
    return ContrastPreference.Less
  }
  if (doesMatch(matchMedia, 'forced')) {
    return ContrastPreference.ForcedColors
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(prefers-contrast: ${value})`).matches
}

function resolveMatchMedia(options: ContrastOptions): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: prefers-contrast preference code (`undefined` when unsupported). */
export const getContrast: Source<BuiltinSourceOptions, ContrastPreferenceCode | undefined> =
  () => getContrastValue()
