import { getIntl, toFloat, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Minimal Date constructor used for DST-stable offset fallback. */
export type OffsetDateCtor = {
  new (): { getFullYear(): number; getTimezoneOffset(): number }
  new (
    year: number,
    monthIndex: number,
    date: number,
  ): { getFullYear(): number; getTimezoneOffset(): number }
}

export type TimezoneOptions = {
  /**
   * Inject `Intl` (or `null` to force offset fallback).
   * When unset, uses live `getIntl()`.
   */
  Intl?: typeof Intl | null
  /** Inject `Date` constructor for offset fallback tests. */
  DateCtor?: OffsetDateCtor
}

/**
 * Timezone identity: prefer `Intl.DateTimeFormat` IANA name; else DST-stable UTC offset.
 * Never hardcodes a region (e.g. Asia/Tehran) — reports runtime capability only.
 */
export function getTimezoneValue(options: TimezoneOptions = {}): string {
  const intl = resolveIntl(options)
  const DateTimeFormat = intl?.DateTimeFormat
  if (DateTimeFormat) {
    const timezone = new DateTimeFormat().resolvedOptions().timeZone
    if (timezone) {
      return timezone
    }
  }

  // Browsers without timezone names: JS offset is opposite wall-clock sign.
  const offset = -getTimezoneOffsetMinutes(options.DateCtor ?? (Date as unknown as OffsetDateCtor))
  return `UTC${offset >= 0 ? '+' : ''}${offset}`
}

function resolveIntl(options: TimezoneOptions): typeof Intl | undefined {
  if ('Intl' in options) {
    return options.Intl ?? undefined
  }
  const probe = getIntl()
  return probe.status === 'ok' ? probe.value : undefined
}

/**
 * Non-DST (winter-like) offset in minutes via max of January and July offsets.
 * Handles both hemispheres' DST seasons.
 */
export function getTimezoneOffsetMinutes(
  DateCtor: OffsetDateCtor = Date as unknown as OffsetDateCtor,
): number {
  const currentYear = new DateCtor().getFullYear()
  return Math.max(
    toFloat(new DateCtor(currentYear, 0, 1).getTimezoneOffset()),
    toFloat(new DateCtor(currentYear, 6, 1).getTimezoneOffset()),
  )
}

/** Entropy source: timezone identity (`Intl` name or UTC±offset fallback). */
export const getTimezone: Source<BuiltinSourceOptions, string> = () => getTimezoneValue()
