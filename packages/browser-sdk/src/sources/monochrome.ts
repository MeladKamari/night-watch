import { getMatchMedia, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * Upper bound for the linear `max-monochrome` search.
 * Expected depths are ≤10; 100 prevents an infinite loop while matching upstream.
 */
export const MONOCHROME_MAX_VALUE_TO_CHECK = 100

export type MatchMediaLike = (query: string) => { readonly matches: boolean }

export type MonochromeOptions = {
  /** Inject matchMedia for tests (skips live `getMatchMedia`). */
  matchMedia?: MatchMediaLike | null
}

/**
 * CSS `monochrome` media feature depth.
 * - Color display → `0`
 * - Monochrome display → bits-per-pixel (`≥0`)
 * - Unsupported / missing matchMedia → `undefined`
 *
 * Throws if depth exceeds {@link MONOCHROME_MAX_VALUE_TO_CHECK} (surfaces as component error).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/monochrome
 */
export function getMonochromeValue(options: MonochromeOptions = {}): number | undefined {
  const matchMedia = resolveMatchMedia(options)
  if (!matchMedia) {
    return undefined
  }
  return detectMonochromeDepth(matchMedia)
}

export function detectMonochromeDepth(matchMedia: MatchMediaLike): number | undefined {
  // `(min-monochrome: 0)` is true when the feature is supported (including color → 0).
  if (!matchMedia('(min-monochrome: 0)').matches) {
    return undefined
  }

  // Linear search — depths are tiny (≤10); binary search isn't worth the complexity.
  for (let i = 0; i <= MONOCHROME_MAX_VALUE_TO_CHECK; ++i) {
    if (matchMedia(`(max-monochrome: ${i})`).matches) {
      return i
    }
  }

  throw new Error('Too high value')
}

function resolveMatchMedia(options: MonochromeOptions): MatchMediaLike | null | undefined {
  if ('matchMedia' in options) {
    return options.matchMedia
  }
  const probe = getMatchMedia()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value
}

/** Entropy source: monochrome bit depth (`undefined` when unsupported). */
export const getMonochrome: Source<BuiltinSourceOptions, number | undefined> = () =>
  getMonochromeValue()
