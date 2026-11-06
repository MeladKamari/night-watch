import { getWindow, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * Fixed allowlist of browser-specific (not engine-specific) window globals.
 * Order here is documentation order; hashed output is always `.sort()`ed.
 */
export const VENDOR_FLAVOR_KEYS = [
  // Blink and some browsers on iOS
  'chrome',

  // Safari on macOS
  'safari',

  // Chrome on iOS (checked in 85 on 13 and 87 on 14)
  '__crWeb',
  '__gCrWeb',

  // Yandex Browser on iOS, macOS and Android (checked in 21.2 on iOS 14, macOS and Android)
  'yandex',

  // Yandex Browser on iOS (checked in 21.2 on 14)
  '__yb',
  '__ybro',

  // Firefox on iOS (checked in 32 on 14)
  '__firefox__',

  // Edge on iOS (checked in 46 on 14)
  '__edgeTrackingPreventionStatistics',
  'webkit',

  // Opera Touch on iOS (checked in 2.6 on 14)
  'oprt',

  // Samsung Internet on Android (checked in 11.1)
  'samsungAr',

  // UC Browser on Android (checked in 12.10 and 13.0)
  'ucweb',
  'UCShellJava',

  // Puffin on Android (checked in 9.0)
  'puffinDevice',

  // UC on iOS and Opera on Android have no specific global variables
  // Edge for Android isn't checked
] as const

export type VendorFlavorKey = (typeof VENDOR_FLAVOR_KEYS)[number]

/** Window-like surface for vendor-flavor presence probes (property reads only). */
export type WindowWithVendorFlavors = Record<string, unknown>

export type VendorFlavorsOptions = {
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: WindowWithVendorFlavors | null
}

/**
 * Detects presence of allowlisted vendor globals.
 * Returns sorted key names only — never invokes vendor extension APIs.
 */
export function getVendorFlavorsValue(options: VendorFlavorsOptions = {}): string[] {
  if ('window' in options) {
    return collectVendorFlavors(options.window)
  }
  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return []
  }
  return collectVendorFlavors(winProbe.value as unknown as WindowWithVendorFlavors)
}

/**
 * Presence filter: truthy value with `typeof === 'object'` (excludes null via falsiness).
 * Does not call methods on matched objects.
 */
export function collectVendorFlavors(
  windowLike: WindowWithVendorFlavors | null | undefined,
): string[] {
  if (windowLike == null) {
    return []
  }

  const flavors: string[] = []
  for (const key of VENDOR_FLAVOR_KEYS) {
    const value = windowLike[key]
    if (value && typeof value === 'object') {
      flavors.push(key)
    }
  }
  return flavors.sort()
}

/** Entropy source: browser-specific window global flavors (sorted names). */
export const getVendorFlavors: Source<BuiltinSourceOptions, string[]> = () =>
  getVendorFlavorsValue()
