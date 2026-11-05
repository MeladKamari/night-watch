import { getWindow, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Minimal window surface for sessionStorage existence probe. */
export type WindowWithSessionStorage = {
  readonly sessionStorage?: Storage | null
}

export type SessionStorageOptions = {
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: WindowWithSessionStorage | null
}

/**
 * Probes whether `sessionStorage` exists.
 * Does **not** read or write keys (no tracking identifier persistence).
 * `SecurityError` when referencing the property means it exists but is blocked → `true`.
 */
export function getSessionStorageValue(options: SessionStorageOptions = {}): boolean {
  if ('window' in options) {
    return probeSessionStorage(options.window)
  }
  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return false
  }
  return probeSessionStorage(winProbe.value)
}

export function probeSessionStorage(
  windowLike: WindowWithSessionStorage | null | undefined,
): boolean {
  if (windowLike == null) {
    return false
  }
  try {
    return !!windowLike.sessionStorage
  } catch {
    // SecurityError when referencing it means it exists (e.g. blocked third-party iframe).
    return true
  }
}

/** Entropy source: sessionStorage availability (existence only). */
export const getSessionStorage: Source<BuiltinSourceOptions, boolean> = () =>
  getSessionStorageValue()
