import { getScreen, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/** Minimal screen surface for color-depth reads. */
export type ScreenWithColorDepth = {
  readonly colorDepth?: number
}

export type ColorDepthOptions = {
  /** Inject screen-like object for tests (skips live `getScreen`). */
  screen?: ScreenWithColorDepth | null
}

/**
 * Reads `screen.colorDepth` as reported by the runtime.
 * Does not invent a bit depth (e.g. 24) when screen is missing.
 * Zero and NaN are preserved when the API returns them.
 */
export function getColorDepthValue(options: ColorDepthOptions = {}): number | undefined {
  if ('screen' in options) {
    return readColorDepth(options.screen)
  }
  const screenProbe = getScreen()
  if (screenProbe.status !== 'ok') {
    return undefined
  }
  return readColorDepth(screenProbe.value)
}

export function readColorDepth(
  screenLike: ScreenWithColorDepth | null | undefined,
): number | undefined {
  if (screenLike == null) {
    return undefined
  }
  return screenLike.colorDepth
}

/** Entropy source: display color depth (`screen.colorDepth`). */
export const getColorDepth: Source<BuiltinSourceOptions, number | undefined> = () =>
  getColorDepthValue()
