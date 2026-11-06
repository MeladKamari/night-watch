import {
  getNavigator,
  isDesktopWebKit,
  isIPad,
  isWebKit,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

export type NavigatorWithPlatform = {
  readonly platform?: string
}

export type PlatformOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithPlatform | null
  /** Override WebKit detector (tests). When unset on live path, uses `isWebKit()`. */
  isWebKit?: boolean
  /** Override desktop-WebKit detector (tests). */
  isDesktopWebKit?: boolean
  /** Override iPad detector (tests). */
  isIPad?: boolean
}

/**
 * Reads `navigator.platform` with iOS desktop-mode normalization.
 * When WebKit reports `MacIntel` but is not desktop WebKit, remap to `iPad` / `iPhone`.
 * Does not invent platform strings for Android/Windows/Linux from UA.
 */
export function getPlatformValue(options: PlatformOptions = {}): string {
  const platform = readRawPlatform(options)
  if (platform === 'MacIntel') {
    const webkit = resolveFlag(options, 'isWebKit', () => isWebKit())
    const desktop = resolveFlag(options, 'isDesktopWebKit', () => isDesktopWebKit())
    if (webkit && !desktop) {
      const ipad = resolveFlag(options, 'isIPad', () => isIPad())
      return ipad ? 'iPad' : 'iPhone'
    }
  }
  return platform
}

function readRawPlatform(options: PlatformOptions): string {
  if ('navigator' in options) {
    return options.navigator?.platform ?? ''
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return ''
  }
  return (navProbe.value as NavigatorWithPlatform).platform ?? ''
}

function resolveFlag(
  options: PlatformOptions,
  key: 'isWebKit' | 'isDesktopWebKit' | 'isIPad',
  live: () => boolean,
): boolean {
  if (key in options) {
    return options[key] === true
  }
  // Inject-only path without detector overrides: do not call live browser detectors.
  if ('navigator' in options) {
    return false
  }
  return live()
}

/** Entropy source: `navigator.platform` with mobile-WebKit MacIntel remap. */
export const getPlatform: Source<BuiltinSourceOptions, string> = () => getPlatformValue()
