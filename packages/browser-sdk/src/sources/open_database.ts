import { getWindow, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Legacy WebSQL `openDatabase` (removed from modern Chromium; may exist on older WebKit). */
export type WindowWithOpenDatabase = {
  readonly openDatabase?: unknown
}

export type OpenDatabaseOptions = {
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: WindowWithOpenDatabase | null
}

/**
 * Probes whether `window.openDatabase` exists (historical WebSQL capability).
 * Does **not** call `openDatabase` — no database creation.
 */
export function getOpenDatabaseValue(options: OpenDatabaseOptions = {}): boolean {
  if ('window' in options) {
    return probeOpenDatabase(options.window)
  }
  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return false
  }
  return probeOpenDatabase(winProbe.value as WindowWithOpenDatabase)
}

export function probeOpenDatabase(
  windowLike: WindowWithOpenDatabase | null | undefined,
): boolean {
  if (windowLike == null) {
    return false
  }
  return !!windowLike.openDatabase
}

/** Entropy source: legacy WebSQL `openDatabase` presence. */
export const getOpenDatabase: Source<BuiltinSourceOptions, boolean> = () => getOpenDatabaseValue()
