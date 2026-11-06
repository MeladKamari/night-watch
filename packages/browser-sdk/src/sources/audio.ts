import {
  getDocument,
  getOfflineAudioContextConstructor,
  isBrowserEnvironment,
  isChromium,
  isChromium122OrNewer,
  isDesktopWebKit,
  isPromise,
  isSafariWebKit,
  isSamsungInternet,
  isWebKit,
  isWebKit606OrNewer,
  isWebKit616OrNewer,
  suppressUnhandledRejectionWarning,
  type BuiltinSourceOptions,
  type OfflineAudioContextConstructor,
  type Source,
} from '@thenightwatch/core'

/**
 * Documented special audio fingerprint states (FingerprintJS OSS v5.3.0).
 * These are successful component **values**, not `{ error }`.
 */
export const SpecialFingerprint = {
  /** Browser known for always suspending audio context. */
  KnownForSuspending: -1,
  /** OfflineAudioContext unavailable. */
  NotSupported: -2,
  /** Unexpected timeout / suspended-after-retries. */
  Timeout: -3,
  /** Browser known for anti-fingerprinting noise (e.g. Safari 17 private). */
  KnownForAntifingerprinting: -4,
} as const

export type SpecialFingerprintCode =
  (typeof SpecialFingerprint)[keyof typeof SpecialFingerprint]

const InnerErrorName = {
  Timeout: 'timeout',
  Suspended: 'suspended',
} as const

type InnerErrorNameCode = (typeof InnerErrorName)[keyof typeof InnerErrorName]

/** Sample indices hashed after render (exclusive end = context length). */
export const AUDIO_HASH_FROM_INDEX = 4500
export const AUDIO_HASH_TO_INDEX = 5000
export const AUDIO_SAMPLE_RATE = 44100

export type AudioFingerprintOptions = {
  /** Inject OfflineAudioContext constructor (tests). */
  offlineAudioContext?: OfflineAudioContextConstructor | null
  /** Override antifingerprinting gate (tests). */
  performAntifingerprinting?: boolean
  /** Override suspend gate (tests). */
  suspendAudioContext?: boolean
  /** Override document.hidden for retry counting (tests). */
  isDocumentHidden?: () => boolean
}

/**
 * Entropy source with stabilization for static fingerprinting.
 * Safari ≥17 / Samsung Internet ≥26 skip synthesis (anti-fingerprinting).
 */
export function getAudioFingerprintValue(
  options: AudioFingerprintOptions = {},
): number | (() => Promise<number>) {
  if (
    options.performAntifingerprinting === true ||
    (options.performAntifingerprinting !== false && doesBrowserPerformAntifingerprinting())
  ) {
    return SpecialFingerprint.KnownForAntifingerprinting
  }

  return getUnstableAudioFingerprint(options)
}

/**
 * Unstable audio entropy (no Safari17/Samsung skip). Prefer {@link getAudioFingerprintValue}.
 */
export function getUnstableAudioFingerprint(
  options: AudioFingerprintOptions = {},
): number | (() => Promise<number>) {
  if (!isBrowserEnvironment() && options.offlineAudioContext === undefined) {
    return SpecialFingerprint.NotSupported
  }

  const ctorProbe =
    options.offlineAudioContext === undefined
      ? getOfflineAudioContextConstructor()
      : options.offlineAudioContext === null
        ? ({ status: 'unsupported' as const })
        : ({ status: 'ok' as const, value: options.offlineAudioContext })

  if (ctorProbe.status !== 'ok') {
    return SpecialFingerprint.NotSupported
  }

  if (
    options.suspendAudioContext === true ||
    (options.suspendAudioContext !== false && doesBrowserSuspendAudioContext())
  ) {
    return SpecialFingerprint.KnownForSuspending
  }

  const AudioContext = ctorProbe.value
  const hashFromIndex = AUDIO_HASH_FROM_INDEX
  const hashToIndex = AUDIO_HASH_TO_INDEX
  const context = new AudioContext(1, hashToIndex, AUDIO_SAMPLE_RATE)

  const oscillator = context.createOscillator()
  oscillator.type = 'triangle'
  oscillator.frequency.value = 10000

  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -50
  compressor.knee.value = 40
  compressor.ratio.value = 12
  compressor.attack.value = 0
  compressor.release.value = 0.25

  oscillator.connect(compressor)
  compressor.connect(context.destination)
  oscillator.start(0)

  const isDocumentHidden =
    options.isDocumentHidden ??
    (() => {
      const doc = getDocument()
      return doc.status === 'ok' ? doc.value.hidden : false
    })

  const [renderPromise, finishRendering] = startRenderingAudio(context, isDocumentHidden)
  const fingerprintPromise = suppressUnhandledRejectionWarning(
    renderPromise.then(
      (buffer) => getHash(buffer.getChannelData(0).subarray(hashFromIndex)),
      (error: unknown) => {
        if (
          error instanceof Error &&
          (error.name === InnerErrorName.Timeout || error.name === InnerErrorName.Suspended)
        ) {
          return SpecialFingerprint.Timeout
        }
        throw error
      },
    ),
  )

  return () => {
    finishRendering()
    return fingerprintPromise
  }
}

/** Mobile Safari 11 and older — audio context never leaves suspended without a gesture. */
export function doesBrowserSuspendAudioContext(): boolean {
  return isWebKit() && !isDesktopWebKit() && !isWebKit606OrNewer()
}

/** Safari ≥17 and Samsung Internet ≥26 apply anti-fingerprinting noise / blocks. */
export function doesBrowserPerformAntifingerprinting(): boolean {
  return (
    (isWebKit() && isWebKit616OrNewer() && isSafariWebKit()) ||
    (isChromium() && isSamsungInternet() && isChromium122OrNewer())
  )
}

function startRenderingAudio(
  context: OfflineAudioContext,
  isDocumentHidden: () => boolean,
): readonly [Promise<AudioBuffer>, () => void] {
  const renderTryMaxCount = 3
  const renderRetryDelay = 500
  const runningMaxAwaitTime = 500
  const runningSufficientTime = 5000
  let finalize = () => undefined as void

  const resultPromise = new Promise<AudioBuffer>((resolve, reject) => {
    let isFinalized = false
    let renderTryCount = 0
    let startedRunningAt = 0

    context.oncomplete = (event) => resolve(event.renderedBuffer)

    const startRunningTimeout = () => {
      setTimeout(
        () => reject(makeInnerError(InnerErrorName.Timeout)),
        Math.min(runningMaxAwaitTime, startedRunningAt + runningSufficientTime - Date.now()),
      )
    }

    const tryRender = () => {
      try {
        const renderingPromise = context.startRendering()
        if (isPromise(renderingPromise)) {
          suppressUnhandledRejectionWarning(renderingPromise)
        }

        switch (context.state) {
          case 'running':
            startedRunningAt = Date.now()
            if (isFinalized) {
              startRunningTimeout()
            }
            break
          case 'suspended':
            if (!isDocumentHidden()) {
              renderTryCount++
            }
            if (isFinalized && renderTryCount >= renderTryMaxCount) {
              reject(makeInnerError(InnerErrorName.Suspended))
            } else {
              setTimeout(tryRender, renderRetryDelay)
            }
            break
        }
      } catch (error) {
        reject(error)
      }
    }

    tryRender()

    finalize = () => {
      if (!isFinalized) {
        isFinalized = true
        if (startedRunningAt > 0) {
          startRunningTimeout()
        }
      }
    }
  })

  return [resultPromise, finalize] as const
}

/** Sum of absolute samples — stable scalar fingerprint. */
export function getHash(signal: ArrayLike<number>): number {
  let hash = 0
  for (let i = 0; i < signal.length; ++i) {
    hash += Math.abs(signal[i]!)
  }
  return hash
}

function makeInnerError(name: InnerErrorNameCode): Error {
  const error = new Error(name)
  error.name = name
  return error
}

/**
 * Builtin source: may return a special code immediately or a deferred getter (two-stage).
 * Uses OfflineAudioContext only — no speaker playback.
 */
export const getAudio: Source<BuiltinSourceOptions, number> = () => getAudioFingerprintValue()
