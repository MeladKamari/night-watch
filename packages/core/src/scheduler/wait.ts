/**
 * Resolves after `durationMs` with an optional value.
 * Uses `setTimeout` (acceptable for idle fallback; not used for event-loop yielding).
 */
export function wait<T = undefined>(durationMs: number, resolveWith?: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs, resolveWith as T)
  })
}
