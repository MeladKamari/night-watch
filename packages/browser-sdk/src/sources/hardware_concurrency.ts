import {
  getNavigator,
  isGecko,
  isGecko143OrNewer,
  replaceNaN,
  toInt,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/** Navigator surface for logical processor count (may be a string). */
export type NavigatorWithHardwareConcurrency = {
  readonly hardwareConcurrency?: number | string
}

export type HardwareConcurrencyOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithHardwareConcurrency | null
  /**
   * Apply Firefox 143+ RFP tiering (≤4→4, >4→8).
   * Live path defaults to `isGecko() && isGecko143OrNewer()` when unset.
   * Inject path applies only when set `true`.
   */
  applyFirefoxTiering?: boolean
}

/**
 * Stabilized hardware concurrency.
 * Firefox 143+ spoofs cores in private/ETP strict; we apply the same idempotent
 * tiers (≥8→8, else→4) so normal and private modes match.
 */
export function getHardwareConcurrencyValue(
  options: HardwareConcurrencyOptions = {},
): number | undefined {
  const value = getUnstableHardwareConcurrency(options)
  if (value === undefined) {
    return undefined
  }

  const applyTiering =
    'navigator' in options
      ? options.applyFirefoxTiering === true
      : (options.applyFirefoxTiering ?? (isGecko() && isGecko143OrNewer()))

  if (applyTiering) {
    return value >= 8 ? 8 : 4
  }
  return value
}

/**
 * Raw `navigator.hardwareConcurrency` via `toInt` (NaN→undefined). No Firefox tiering.
 */
export function getUnstableHardwareConcurrency(
  options: HardwareConcurrencyOptions = {},
): number | undefined {
  if ('navigator' in options) {
    return readHardwareConcurrency(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return readHardwareConcurrency(navProbe.value as NavigatorWithHardwareConcurrency)
}

export function readHardwareConcurrency(
  navigatorLike: NavigatorWithHardwareConcurrency | null | undefined,
): number | undefined {
  if (navigatorLike == null) {
    return undefined
  }
  return replaceNaN(toInt(navigatorLike.hardwareConcurrency), undefined)
}

/** Entropy source: logical processor count (`navigator.hardwareConcurrency`). */
export const getHardwareConcurrency: Source<BuiltinSourceOptions, number | undefined> = () =>
  getHardwareConcurrencyValue()
