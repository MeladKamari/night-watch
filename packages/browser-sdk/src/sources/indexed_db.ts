import {
  getWindow,
  isEdgeHTML,
  isTrident,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/** Minimal window surface for IndexedDB existence probe. */
export type WindowWithIndexedDB = {
  readonly indexedDB?: IDBFactory | null
}

export type IndexedDBOptions = {
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: WindowWithIndexedDB | null
  /**
   * Skip probe and return `undefined` (IE/EdgeHTML private-mode stabilization).
   * Live path defaults to `isTrident() || isEdgeHTML()` when unset.
   * Inject path skips only when set `true`.
   */
  skipLegacyIE?: boolean
}

/**
 * Probes whether `indexedDB` exists — does **not** open or write databases.
 * IE/EdgeHTML return `undefined` so private vs normal mode do not diverge the hash.
 * `SecurityError` on property access → `true` (API exists but restricted).
 */
export function getIndexedDBValue(options: IndexedDBOptions = {}): boolean | undefined {
  if ('window' in options) {
    if (options.skipLegacyIE === true) {
      return undefined
    }
    return probeIndexedDB(options.window)
  }

  if (options.skipLegacyIE !== false && (isTrident() || isEdgeHTML())) {
    return undefined
  }

  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return false
  }
  return probeIndexedDB(winProbe.value)
}

export function probeIndexedDB(windowLike: WindowWithIndexedDB | null | undefined): boolean {
  if (windowLike == null) {
    return false
  }
  try {
    return !!windowLike.indexedDB
  } catch {
    // SecurityError when referencing it means it exists.
    return true
  }
}

/** Entropy source: IndexedDB availability (existence only; no open/write). */
export const getIndexedDB: Source<BuiltinSourceOptions, boolean | undefined> = () =>
  getIndexedDBValue()
