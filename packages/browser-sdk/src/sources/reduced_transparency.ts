import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * CSS `prefers-reduced-transparency` media feature.
 * Tri-state: `true` (reduce), `false` (no-preference), `undefined` (unsupported / older browsers).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
 */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type ReducedTransparencyOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Reads `(prefers-reduced-transparency: reduce|no-preference)`.
 * Missing matchMedia or neither value matching → `undefined` (never invent `false`).
 */
export function getReducedTransparencyValue(
  options: ReducedTransparencyOptions = {},
): boolean | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectReducedTransparency(matchMedia)
}

export function detectReducedTransparency(
  matchMedia: MatchMediaLike,
): boolean | undefined {
  if (doesMatch(matchMedia, 'reduce')) {
    return true
  }
  if (doesMatch(matchMedia, 'no-preference')) {
    return false
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(prefers-reduced-transparency: ${value})`).matches
}

function resolveMatchMedia(
  options: ReducedTransparencyOptions,
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

/** Entropy source: prefers-reduced-transparency (tri-state boolean | undefined). */
export const getReducedTransparency: Source<BuiltinSourceOptions, boolean | undefined> =
  () => getReducedTransparencyValue()
