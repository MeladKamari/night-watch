/**
 * Trackable timer helpers so budget timeouts can be cleared (no leaked timers).
 * Used by the budget module and unit tests.
 */
export type TimerHandle = {
  readonly id: ReturnType<typeof setTimeout>
  clear(): void
}

export type TimerRegistry = {
  schedule(fn: () => void, ms: number): TimerHandle
  clearAll(): void
  readonly pendingCount: number
}

export function createTimerRegistry(): TimerRegistry {
  const pending = new Set<ReturnType<typeof setTimeout>>()

  return {
    schedule(fn: () => void, ms: number): TimerHandle {
      const id = setTimeout(() => {
        pending.delete(id)
        fn()
      }, ms)
      pending.add(id)
      return {
        id,
        clear() {
          if (pending.has(id)) {
            clearTimeout(id)
            pending.delete(id)
          }
        },
      }
    },
    clearAll() {
      for (const id of pending) {
        clearTimeout(id)
      }
      pending.clear()
    },
    get pendingCount() {
      return pending.size
    },
  }
}

export function toAbortError(reason?: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }
  const error = new Error(typeof reason === 'string' ? reason : 'Aborted')
  error.name = 'AbortError'
  return error
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw toAbortError(signal.reason)
  }
}

/** Abort when either signal aborts. */
export function linkAbortSignals(
  a?: AbortSignal,
  b?: AbortSignal,
): AbortSignal | undefined {
  if (!a && !b) return undefined
  if (a && !b) return a
  if (b && !a) return b
  if (typeof AbortController === 'undefined') {
    return a ?? b
  }
  if (
    typeof AbortSignal !== 'undefined' &&
    'any' in AbortSignal &&
    typeof AbortSignal.any === 'function'
  ) {
    return AbortSignal.any([a!, b!])
  }
  const controller = new AbortController()
  const forward = (signal: AbortSignal) => {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return
    }
    signal.addEventListener(
      'abort',
      () => {
        controller.abort(signal.reason)
      },
      { once: true },
    )
  }
  forward(a!)
  forward(b!)
  return controller.signal
}
