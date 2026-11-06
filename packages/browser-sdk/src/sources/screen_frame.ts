import {
  exitFullscreen,
  getFullscreenElement,
  getScreen,
  isBrowserEnvironment,
  isGecko,
  isGecko143OrNewer,
  isSafariWebKit,
  isWebKit,
  isWebKit616OrNewer,
  replaceNaN,
  round,
  toFloat,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/**
 * Screen chrome insets as CSS side order: top, right, bottom, left.
 * `null` sides mean unavailable / non-finite after normalization.
 */
export type FrameSize = [number | null, number | null, number | null, number | null]

export const screenFrameCheckInterval = 2500
const roundingPrecision = 10

type ScreenLike = {
  width: unknown
  height: unknown
  availWidth: unknown
  availHeight: unknown
  availTop?: unknown
  availLeft?: unknown
}

export type ScreenFrameOptions = {
  /**
   * When true, may call `exitFullscreen()` if the frame is null while programmatic
   * fullscreen is active (upstream FingerprintJS behavior).
   * **Default false** — Self-hosted: do not yank the user out of fullscreen (D-021).
   */
  allowExitFullscreen?: boolean
  /** Injected screen (unit tests). */
  screen?: ScreenLike | null
}

// Module watch state — timers cleared via resetScreenFrameWatch (tests / dispose).
let screenFrameBackup: Readonly<FrameSize> | undefined
let screenFrameSizeTimeoutId: ReturnType<typeof setTimeout> | undefined

/**
 * Watches until a non-null frame appears, then caches it.
 * Mitigates transient null frames (FingerprintJS #568).
 */
function watchScreenFrame(getFrame: () => FrameSize = getCurrentScreenFrame): void {
  if (screenFrameSizeTimeoutId !== undefined) {
    return
  }
  const checkScreenFrame = () => {
    const frameSize = getFrame()
    if (isFrameSizeNull(frameSize)) {
      screenFrameSizeTimeoutId = setTimeout(checkScreenFrame, screenFrameCheckInterval)
    } else {
      screenFrameBackup = frameSize
      screenFrameSizeTimeoutId = undefined
    }
  }
  checkScreenFrame()
}

/** Clears backup + pending timer (tests / agent teardown). */
export function resetScreenFrameWatch(): void {
  if (screenFrameSizeTimeoutId !== undefined) {
    clearTimeout(screenFrameSizeTimeoutId)
    screenFrameSizeTimeoutId = undefined
  }
  screenFrameBackup = undefined
}

/** Exposed for tests — current backup snapshot. */
export function getScreenFrameBackupForTests(): Readonly<FrameSize> | undefined {
  return screenFrameBackup
}

export function isFrameSizeNull(frameSize: FrameSize): boolean {
  for (let i = 0; i < 4; ++i) {
    if (frameSize[i]) {
      return false
    }
  }
  return true
}

/**
 * Reads avail* / size deltas from a screen-like object.
 * Handles stringified numbers from privacy plugins.
 */
export function getCurrentScreenFrame(screenSource?: ScreenLike | null): FrameSize {
  let s: ScreenLike | null | undefined = screenSource
  if (s === undefined) {
    if (!isBrowserEnvironment()) {
      return [null, null, null, null]
    }
    const probe = getScreen()
    if (probe.status !== 'ok') {
      return [null, null, null, null]
    }
    s = probe.value as ScreenLike
  }
  if (s == null) {
    return [null, null, null, null]
  }

  return [
    replaceNaN(toFloat(s.availTop), null),
    replaceNaN(toFloat(s.width) - toFloat(s.availWidth) - replaceNaN(toFloat(s.availLeft), 0), null),
    replaceNaN(toFloat(s.height) - toFloat(s.availHeight) - replaceNaN(toFloat(s.availTop), 0), null),
    replaceNaN(toFloat(s.availLeft), null),
  ]
}

/**
 * Unstable (unrounded) screen frame getter factory.
 * Starts the backup watch; returns a deferred async getter (two-stage source).
 */
export function getUnstableScreenFrame(
  options: ScreenFrameOptions = {},
): () => Promise<FrameSize> {
  const read = () => getCurrentScreenFrame(options.screen)
  watchScreenFrame(read)

  return async () => {
    let frameSize = read()

    if (isFrameSizeNull(frameSize)) {
      if (screenFrameBackup) {
        return [...screenFrameBackup] as FrameSize
      }

      if (options.allowExitFullscreen === true && getFullscreenElement()) {
        // Upstream path only — optional; default SDK does not exit fullscreen (D-021).
        try {
          await exitFullscreen()
        } catch {
          // Fullscreen exit may be blocked; keep null frame / backup path.
        }
        frameSize = read()
      }
    }

    if (!isFrameSizeNull(frameSize)) {
      screenFrameBackup = frameSize
    }

    return frameSize
  }
}

function shouldSkipScreenFrame(): boolean {
  const isSafari17OrAbove = isWebKit() && isWebKit616OrNewer() && isSafariWebKit()
  const isFirefox143OrAbove = isGecko() && isGecko143OrNewer()
  return isSafari17OrAbove || isFirefox143OrAbove
}

/**
 * Stabilized screen frame: rounded sides, or `undefined` on Safari 17+ / Firefox 143+
 * (privacy spoofing). Default does **not** exit fullscreen.
 */
export function getScreenFrameValue(
  options: ScreenFrameOptions = {},
): () => Promise<FrameSize | undefined> {
  if (shouldSkipScreenFrame()) {
    return () => Promise.resolve(undefined)
  }

  const screenFrameGetter = getUnstableScreenFrame(options)

  return async () => {
    const frameSize = await screenFrameGetter()
    const processSize = (sideSize: FrameSize[number]) =>
      sideSize === null ? null : round(sideSize, roundingPrecision)

    return [
      processSize(frameSize[0]),
      processSize(frameSize[1]),
      processSize(frameSize[2]),
      processSize(frameSize[3]),
    ]
  }
}

/**
 * Builtin source — deferred getter returning rounded frame or `undefined`.
 */
export const getScreenFrame: Source<BuiltinSourceOptions, FrameSize | undefined> = () =>
  getScreenFrameValue({ allowExitFullscreen: false })
