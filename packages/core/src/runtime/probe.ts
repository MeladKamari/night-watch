/**
 * Deterministic probe result schema for browser capability checks.
 *
 * - `ok`: API present and usable; `value` is the result
 * - `unsupported`: API absent in this environment (e.g. Node / missing constructor)
 * - `blocked`: API present but access denied (SecurityError, NotAllowedError, feature policy)
 * - `error`: unexpected failure while probing
 *
 * Do not conflate source-level sentinel values with `{ error }` component results.
 */

export type ProbeStatus = 'ok' | 'unsupported' | 'blocked' | 'error'

export type ProbeResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'unsupported' }
  | { status: 'blocked'; reason?: string; error?: unknown }
  | { status: 'error'; error: unknown }

export function ok<T>(value: T): ProbeResult<T> {
  return { status: 'ok', value }
}

export function unsupported<T = never>(): ProbeResult<T> {
  return { status: 'unsupported' }
}

export function blocked<T = never>(reason?: string, error?: unknown): ProbeResult<T> {
  if (reason !== undefined && error !== undefined) {
    return { status: 'blocked', reason, error }
  }
  if (reason !== undefined) {
    return { status: 'blocked', reason }
  }
  if (error !== undefined) {
    return { status: 'blocked', error }
  }
  return { status: 'blocked' }
}

export function probeError<T = never>(error: unknown): ProbeResult<T> {
  return { status: 'error', error }
}

/** Permission / sandbox style denials that should map to `blocked`, not `error`. */
export function isBlockedBrowserError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return error.name === 'SecurityError' || error.name === 'NotAllowedError'
}

/**
 * Runs a probe body and classifies thrown exceptions.
 * Returns `unsupported` when `isPresent` is false (caller decides presence).
 */
export function runProbe<T>(isPresent: boolean, read: () => T): ProbeResult<T> {
  if (!isPresent) {
    return unsupported()
  }
  try {
    return ok(read())
  } catch (error) {
    if (isBlockedBrowserError(error)) {
      return blocked(error instanceof Error ? error.name : 'blocked', error)
    }
    return probeError(error)
  }
}
