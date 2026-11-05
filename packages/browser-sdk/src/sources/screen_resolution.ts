import {
  getScreen,
  isSafariWebKit,
  isWebKit,
  isWebKit616OrNewer,
  replaceNaN,
  toInt,
  type BuiltinSourceOptions,
  type Source,
} from '@night-watch/core'

/** Orientation-independent `[larger, smaller]` pair; `null` = non-finite after parse. */
export type ScreenResolution = [number | null, number | null]

type ScreenLike = {
  width?: unknown
  height?: unknown
}

export type ScreenResolutionOptions = {
  /** Injected screen (unit tests). */
  screen?: ScreenLike | null
  /**
   * Force Safari 17+ private-mode skip (`undefined`).
   * Live path defaults to WebKit616 + SafariWebKit detectors when unset.
   * Inject path skips only when set `true`.
   */
  skipSafariPrivate?: boolean
}

/**
 * Stabilized screen resolution: skipped on Safari 17+ (private mode uses document size).
 */
export function getScreenResolutionValue(
  options: ScreenResolutionOptions = {},
): ScreenResolution | undefined {
  if ('screen' in options) {
    if (options.skipSafariPrivate === true) {
      return undefined
    }
    return getUnstableScreenResolution(options)
  }

  if (
    options.skipSafariPrivate !== false &&
    isWebKit() &&
    isWebKit616OrNewer() &&
    isSafariWebKit()
  ) {
    return undefined
  }

  return getUnstableScreenResolution(options)
}

/**
 * Unstable screen resolution (no Safari private skip unless options force it).
 * Dimensions are sorted descending via default string `sort` then `reverse`
 * (upstream v5.3.0) so portrait/landscape match.
 */
export function getUnstableScreenResolution(
  options: ScreenResolutionOptions = {},
): ScreenResolution {
  let screenLike: ScreenLike | null | undefined
  if ('screen' in options) {
    screenLike = options.screen
  } else {
    const probe = getScreen()
    if (probe.status !== 'ok') {
      return [null, null]
    }
    screenLike = probe.value
  }

  if (screenLike == null) {
    return [null, null]
  }

  const parseDimension = (value: unknown) => replaceNaN(toInt(value), null)
  const dimensions = [parseDimension(screenLike.width), parseDimension(screenLike.height)] as ScreenResolution
  // Default Array#sort is lexicographic (upstream parity — do not switch to numeric compare).
  dimensions.sort().reverse()
  return dimensions
}

/** Entropy source: physical screen width/height (orientation-normalized). */
export const getScreenResolution: Source<BuiltinSourceOptions, ScreenResolution | undefined> = () =>
  getScreenResolutionValue()
