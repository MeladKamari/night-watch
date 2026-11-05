import type { MaybePromise } from '../types.js'

export function isPromise<T>(value: PromiseLike<T> | unknown): value is PromiseLike<T> {
  return !!value && typeof (value as PromiseLike<T>).then === 'function'
}

/**
 * Calls a maybe-asynchronous function without forcing an extra microtask when sync.
 * Catches sync throws and async rejections into the callback.
 */
export function awaitIfAsync<TResult, TError = unknown>(
  action: () => MaybePromise<TResult>,
  callback: (...args: [success: true, result: TResult] | [success: false, error: TError]) => unknown,
): void {
  try {
    const returnedValue = action()
    if (isPromise(returnedValue)) {
      returnedValue.then(
        (result) => callback(true, result),
        (error: TError) => callback(false, error),
      )
    } else {
      callback(true, returnedValue)
    }
  } catch (error) {
    callback(false, error as TError)
  }
}

/**
 * Attaches a no-op rejection handler so the promise does not emit an unhandled
 * rejection warning, while still propagating errors to subsequent handlers.
 * Returns the input promise for convenience.
 */
export function suppressUnhandledRejectionWarning<T extends PromiseLike<unknown>>(promise: T): T {
  promise.then(undefined, () => undefined)
  return promise
}
