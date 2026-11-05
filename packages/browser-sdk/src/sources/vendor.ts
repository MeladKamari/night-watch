import { getNavigator, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** `navigator.vendor` surface. */
export type NavigatorWithVendor = {
  readonly vendor?: string
}

export type VendorOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithVendor | null
}

/**
 * Reads `navigator.vendor` with empty-string fallback.
 * Never invents a brand from UA (e.g. does not synthesize "Google Inc.").
 */
export function getVendorValue(options: VendorOptions = {}): string {
  if ('navigator' in options) {
    return readVendor(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return ''
  }
  return readVendor(navProbe.value as NavigatorWithVendor)
}

export function readVendor(navigatorLike: NavigatorWithVendor | null | undefined): string {
  if (navigatorLike == null) {
    return ''
  }
  return navigatorLike.vendor || ''
}

/** Entropy source: `navigator.vendor` (empty string when absent). */
export const getVendor: Source<BuiltinSourceOptions, string> = () => getVendorValue()
