import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * CSS `dynamic-range` media feature (HDR vs SDR).
 * Tri-state: `true` (high), `false` (standard), `undefined` (unsupported).
 *
 * @see https://www.w3.org/TR/mediaqueries-5/#dynamic-range
 */
export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type HdrOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * Reads `(dynamic-range: high|standard)`.
 * Missing matchMedia or neither value matching → `undefined` (never invent `false` / SDR).
 */
export function getHdrValue(options: HdrOptions = {}): boolean | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectHdr(matchMedia)
}

export function detectHdr(matchMedia: MatchMediaLike): boolean | undefined {
  if (doesMatch(matchMedia, 'high')) {
    return true
  }
  if (doesMatch(matchMedia, 'standard')) {
    return false
  }
  return undefined
}

function doesMatch(matchMedia: MatchMediaLike, value: string): boolean {
  return matchMedia(`(dynamic-range: ${value})`).matches
}

function resolveMatchMedia(options: HdrOptions): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: dynamic-range / HDR capability (tri-state boolean | undefined). */
export const getHdr: Source<BuiltinSourceOptions, boolean | undefined> = () => getHdrValue()
