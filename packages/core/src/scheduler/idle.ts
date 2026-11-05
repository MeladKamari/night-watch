import { wait } from './wait.js'

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number }
type RequestIdleCallbackLike = (
  callback: (deadline: IdleDeadlineLike) => void,
  options?: { timeout?: number },
) => number

/**
 * Waits for an idle period when `requestIdleCallback` exists; otherwise waits
 * `min(fallbackTimeout, deadlineTimeout)` ms.
 *
 * Mirrors FingerprintJS OSS v5.3.0 `requestIdleCallbackIfAvailable`.
 * Binds the callback to the realm that owns `requestIdleCallback` (window vs globalThis).
 * Safe under Node: always takes the finite timeout fallback.
 */
export function requestIdleCallbackIfAvailable(
  fallbackTimeout: number,
  deadlineTimeout: number = Number.POSITIVE_INFINITY,
): Promise<void> {
  const ric = resolveRequestIdleCallback()
  if (ric) {
    return new Promise((resolve) => {
      ric(() => resolve(), { timeout: deadlineTimeout })
    })
  }
  return wait(Math.min(fallbackTimeout, deadlineTimeout))
}

function resolveRequestIdleCallback(): RequestIdleCallbackLike | undefined {
  try {
    const g = globalThis as typeof globalThis & {
      window?: { requestIdleCallback?: RequestIdleCallbackLike }
      requestIdleCallback?: RequestIdleCallbackLike
    }

    if (g.window && typeof g.window.requestIdleCallback === 'function') {
      // Preserve binding to `window` (see fingerprintjs#683).
      return g.window.requestIdleCallback.bind(g.window) as RequestIdleCallbackLike
    }

    if (typeof g.requestIdleCallback === 'function') {
      return g.requestIdleCallback.bind(g) as RequestIdleCallbackLike
    }
  } catch {
    return undefined
  }
  return undefined
}
