import { getWindow, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * Special `dateTimeLocale` component values (FingerprintJS OSS v5.3.0).
 * These are successful hashed **values**, not `{ error }` outcomes.
 */
export const DateTimeLocaleStatus = {
  /** `window.Intl` missing. */
  IntlAPINotSupported: -1,
  /** `Intl.DateTimeFormat` constructor missing. */
  DateTimeFormatNotSupported: -2,
  /** `resolvedOptions().locale` is `undefined` or `null` (empty string is kept). */
  LocaleNotAvailable: -3,
} as const

export type DateTimeLocaleStatusCode =
  (typeof DateTimeLocaleStatus)[keyof typeof DateTimeLocaleStatus]

/** Successful locale string or a documented special status code. */
export type DateTimeLocaleResult = string | DateTimeLocaleStatusCode

/** Minimal `Intl.DateTimeFormat` surface for the default-locale probe. */
export type DateTimeFormatLike = {
  (): { resolvedOptions(): { locale?: string | null } }
  new (): { resolvedOptions(): { locale?: string | null } }
}

export type IntlWithDateTimeFormat = {
  readonly DateTimeFormat?: DateTimeFormatLike
}

export type DateTimeLocaleOptions = {
  /**
   * Inject Intl-like object for tests.
   * `null` simulates missing Intl API.
   */
  intl?: IntlWithDateTimeFormat | null
}

/**
 * Reads `Intl.DateTimeFormat().resolvedOptions().locale` for the **default** locale.
 * Does not force calendars (Jalali/Persian), numerals, or region — visitor prefs stay intact.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions
 */
export function getDateTimeLocaleValue(
  options: DateTimeLocaleOptions = {},
): DateTimeLocaleResult {
  if ('intl' in options) {
    return collectDateTimeLocale(options.intl)
  }
  // Prefer `window.Intl` (upstream). Fall back to global `Intl` when window is
  // absent (Node / SSR) so we do not invent LocaleNotAvailable / hardcode regions.
  const winProbe = getWindow()
  if (winProbe.status === 'ok') {
    return collectDateTimeLocale((winProbe.value as { Intl?: IntlWithDateTimeFormat }).Intl)
  }
  if (typeof Intl !== 'undefined') {
    return collectDateTimeLocale(Intl as IntlWithDateTimeFormat)
  }
  return DateTimeLocaleStatus.IntlAPINotSupported
}

/**
 * Pure transform of an Intl-like snapshot into locale string or status code.
 */
export function collectDateTimeLocale(
  intl: IntlWithDateTimeFormat | null | undefined,
): DateTimeLocaleResult {
  if (intl == null) {
    return DateTimeLocaleStatus.IntlAPINotSupported
  }

  const DateTimeFormat = intl.DateTimeFormat
  if (!DateTimeFormat) {
    return DateTimeLocaleStatus.DateTimeFormatNotSupported
  }

  const locale = DateTimeFormat().resolvedOptions().locale

  // Keep empty string; only null/undefined map to LocaleNotAvailable.
  if (!locale && locale !== '') {
    return DateTimeLocaleStatus.LocaleNotAvailable
  }

  return locale
}

/** Entropy source: default Intl.DateTimeFormat resolved locale. */
export const getDateTimeLocale: Source<BuiltinSourceOptions, DateTimeLocaleResult> = () =>
  getDateTimeLocaleValue()
