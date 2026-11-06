import {
  getNavigator,
  replaceNaN,
  toFloat,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/** Chromium Device Memory API surface (may be absent on Safari/Firefox). */
export type NavigatorWithDeviceMemory = {
  readonly deviceMemory?: number | string
}

export type DeviceMemoryOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithDeviceMemory | null
}

/**
 * Reads `navigator.deviceMemory` as a coarse number (GiB buckets).
 * String coercions go through `toFloat`; NaN → `undefined`.
 * Does not invent or un-clamp privacy-bucketed RAM values.
 */
export function getDeviceMemoryValue(options: DeviceMemoryOptions = {}): number | undefined {
  if ('navigator' in options) {
    return readDeviceMemory(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return readDeviceMemory(navProbe.value as NavigatorWithDeviceMemory)
}

export function readDeviceMemory(
  navigatorLike: NavigatorWithDeviceMemory | null | undefined,
): number | undefined {
  if (navigatorLike == null) {
    return undefined
  }
  // Some unidentified engines expose deviceMemory as a numeric string.
  return replaceNaN(toFloat(navigatorLike.deviceMemory), undefined)
}

/** Entropy source: approximate device memory (`navigator.deviceMemory`). */
export const getDeviceMemory: Source<BuiltinSourceOptions, number | undefined> = () =>
  getDeviceMemoryValue()
