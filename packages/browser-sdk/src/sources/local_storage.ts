import { getWindow, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/** Minimal window surface for localStorage existence probe. */
export type WindowWithLocalStorage = {
  readonly localStorage?: Storage | null
}

export type LocalStorageOptions = {
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: WindowWithLocalStorage | null
}

/**
 * Probes whether `localStorage` exists.
 * Does **not** read or write keys (no persistent tracking identifier).
 * `SecurityError` when referencing the property means it exists but is blocked → `true`
 * (Firefox bug 781447 / sandboxed iframe semantics).
 */
export function getLocalStorageValue(options: LocalStorageOptions = {}): boolean {
  if ('window' in options) {
    return probeLocalStorage(options.window)
  }
  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return false
  }
  return probeLocalStorage(winProbe.value)
}

export function probeLocalStorage(
  windowLike: WindowWithLocalStorage | null | undefined,
): boolean {
  if (windowLike == null) {
    return false
  }
  try {
    return !!windowLike.localStorage
  } catch {
    // SecurityError when referencing it means it exists.
    return true
  }
}

/** Entropy source: localStorage availability (existence only). */
export const getLocalStorage: Source<BuiltinSourceOptions, boolean> = () => getLocalStorageValue()
