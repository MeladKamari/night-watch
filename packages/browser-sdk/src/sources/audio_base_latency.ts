import {
  getAudioContextConstructor,
  isAndroid,
  isWebKit,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/**
 * Special `audioBaseLatency` component values (FingerprintJS OSS v5.3.0).
 * These are successful hashed **values**, not `{ error }` outcomes.
 * Distinct from OfflineAudioContext `SpecialFingerprint` codes in `audio.ts`.
 */
export const BaseLatencySpecialFingerprint = {
  /** AudioContext or `baseLatency` unavailable / nullish. */
  NotSupported: -1,
  /** Disabled on platforms that warn in the console (non-Android Chromium / Gecko). */
  Disabled: -2,
  /** `baseLatency` is non-finite (`Infinity` / `NaN`). */
  NotFinite: -3,
} as const

export type BaseLatencySpecialFingerprintCode =
  (typeof BaseLatencySpecialFingerprint)[keyof typeof BaseLatencySpecialFingerprint]

/** Minimal AudioContext surface for the baseLatency probe. */
export type AudioContextWithBaseLatency = {
  readonly baseLatency: number | null | undefined
  close?: () => void | Promise<void>
}

export type AudioContextWithBaseLatencyConstructor = {
  new (): AudioContextWithBaseLatency
}

export type AudioBaseLatencyOptions = {
  /**
   * Override platform allow-list (`isAndroid() || isWebKit()`).
   * Use in tests; production should leave unset.
   */
  allowPlatform?: boolean
  /** Inject AudioContext constructor (`null` = unsupported). */
  audioContext?: AudioContextWithBaseLatencyConstructor | null
}

/**
 * Reads `AudioContext.baseLatency` only on Android or WebKit (upstream allow-list
 * avoids Chrome/Firefox console warnings). Always closes the context after the read.
 *
 * @returns Finite latency seconds, or a {@link BaseLatencySpecialFingerprint} code.
 */
export function getAudioBaseLatencyValue(options: AudioBaseLatencyOptions = {}): number {
  const allowed =
    options.allowPlatform !== undefined
      ? options.allowPlatform
      : isAndroid() || isWebKit()

  if (!allowed) {
    return BaseLatencySpecialFingerprint.Disabled
  }

  const Ctor = resolveAudioContextConstructor(options)
  if (Ctor == null) {
    return BaseLatencySpecialFingerprint.NotSupported
  }

  let context: AudioContextWithBaseLatency | undefined
  try {
    context = new Ctor()
    const latency = context.baseLatency

    if (latency === null || latency === undefined) {
      return BaseLatencySpecialFingerprint.NotSupported
    }

    if (!Number.isFinite(latency)) {
      return BaseLatencySpecialFingerprint.NotFinite
    }

    return latency
  } finally {
    closeAudioContext(context)
  }
}

function resolveAudioContextConstructor(
  options: AudioBaseLatencyOptions,
): AudioContextWithBaseLatencyConstructor | undefined {
  if ('audioContext' in options) {
    return options.audioContext ?? undefined
  }
  const probe = getAudioContextConstructor()
  if (probe.status !== 'ok') {
    return undefined
  }
  return probe.value as AudioContextWithBaseLatencyConstructor
}

/**
 * Closes the live AudioContext. Upstream v5.3.0 does not close; we do for
 * resource hygiene without changing the returned fingerprint value.
 */
export function closeAudioContext(
  context: AudioContextWithBaseLatency | null | undefined,
): void {
  if (context == null || typeof context.close !== 'function') {
    return
  }
  try {
    const result = context.close()
    // Suppress unhandled rejection if close returns a Promise.
    if (result != null && typeof (result as Promise<void>).then === 'function') {
      void (result as Promise<void>).catch(() => {
        /* ignore close failures */
      })
    }
  } catch {
    /* ignore sync close failures */
  }
}

/** Whether the current engine is on the upstream allow-list for this source. */
export function isAudioBaseLatencyPlatformAllowed(): boolean {
  return isAndroid() || isWebKit()
}

/** Entropy source: AudioContext.baseLatency (platform-gated). */
export const getAudioBaseLatency: Source<BuiltinSourceOptions, number> = () =>
  getAudioBaseLatencyValue()
