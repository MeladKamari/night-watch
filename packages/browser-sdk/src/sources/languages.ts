import {
  getNavigator,
  isChromium,
  isChromium86OrNewer,
  type BuiltinSourceOptions,
  type Source,
} from '@night-watch/core'

/** Locale fields used by the languages collector (incl. legacy IE names). */
export type NavigatorWithLanguages = {
  readonly language?: string
  readonly languages?: readonly string[] | string
  readonly userLanguage?: string
  readonly browserLanguage?: string
  readonly systemLanguage?: string
}

export type LanguagesOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithLanguages | null
  /**
   * When true, skip pushing `navigator.languages` (Chromium ≥86 privacy normalization).
   * Live path defaults to `isChromium() && isChromium86OrNewer()` when unset.
   * Inject path defaults to `false` (keep the array) when unset.
   */
  skipLanguagesArray?: boolean
}

/**
 * Collects `navigator.language` (+ legacy IE fields) and optionally `navigator.languages`
 * as `string[][]`. Does not reorder, translate, or invent locale codes.
 *
 * Chromium ≥86: omit the `languages` array so Incognito (single-entry languages)
 * matches normal mode for hashing (upstream v5.3.0).
 */
export function getLanguagesValue(options: LanguagesOptions = {}): string[][] {
  if ('navigator' in options) {
    return collectLanguages(options.navigator, options.skipLanguagesArray === true)
  }

  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return []
  }
  const skipLanguagesArray =
    options.skipLanguagesArray ?? (isChromium() && isChromium86OrNewer())
  return collectLanguages(navProbe.value as NavigatorWithLanguages, skipLanguagesArray)
}

/**
 * Pure transform of a navigator-like locale snapshot.
 */
export function collectLanguages(
  navigatorLike: NavigatorWithLanguages | null | undefined,
  skipLanguagesArray = false,
): string[][] {
  if (navigatorLike == null) {
    return []
  }

  const result: string[][] = []
  const n = navigatorLike

  const language = n.language || n.userLanguage || n.browserLanguage || n.systemLanguage
  if (language !== undefined) {
    result.push([language])
  }

  if (Array.isArray(n.languages)) {
    if (!skipLanguagesArray) {
      result.push([...n.languages])
    }
  } else if (typeof n.languages === 'string') {
    const languages = n.languages
    if (languages) {
      result.push(languages.split(','))
    }
  }

  return result
}

/** Entropy source: browser locale list (`navigator.language` / `languages`). */
export const getLanguages: Source<BuiltinSourceOptions, string[][]> = () => getLanguagesValue()
