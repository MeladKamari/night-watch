import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * CSS `prefers-reduced-motion` media feature.
 * Tri-state: `true` (reduce), `false` (no-preference), `undefined` (unsupported).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type ReducedMotionOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Reads `(prefers-reduced-motion: reduce|no-preference)`.
 * Missing matchMedia or neither value matching → `undefined` (never invent `false`).
 */
export function getReducedMotionValue(
  options: ReducedMotionOptions = {},
): boolean | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectReducedMotion(matchMedia)
}

export function detectReducedMotion(matchMedia: MatchMediaLike): boolean | undefined {
  if (doesMatch(matchMedia, 'reduce')) {
    return true
  }
  if (doesMatch(matchMedia, 'no-preference')) {
    return false
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(prefers-reduced-motion: ${value})`).matches
}

function resolveMatchMedia(
  options: ReducedMotionOptions,
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

/** Entropy source: prefers-reduced-motion (tri-state boolean | undefined). */
export const getReducedMotion: Source<BuiltinSourceOptions, boolean | undefined> = () =>
  getReducedMotionValue()
