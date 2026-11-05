import type { MaybePromise } from '../types.js'
import { wait } from '../scheduler/wait.js'
import { UnsupportedEnvironmentError, isBrowserEnvironment } from '../runtime/environment.js'
import { getDocument } from '../runtime/globals.js'
import { DomOperationTimeoutError } from './errors.js'

export type WithIframeOptions = {
  /** Optional initial HTML for `srcdoc` (ignored when unsupported). */
  initialHtml?: string
  /** Poll interval while waiting for `document.body` / iframe body. Default 50. */
  domPollInterval?: number
  /** Fail the operation after this many ms (iframe is still cleaned up). */
  timeoutMs?: number
  /** Abort mid-flight; iframe is removed. */
  signal?: AbortSignal
}

function normalizeOptions(
  initialHtmlOrOptions?: string | WithIframeOptions,
  domPollInterval?: number,
): WithIframeOptions & { domPollInterval: number } {
  if (initialHtmlOrOptions !== undefined && typeof initialHtmlOrOptions === 'object') {
    return {
      ...initialHtmlOrOptions,
      domPollInterval: initialHtmlOrOptions.domPollInterval ?? 50,
    }
  }
  const normalized: WithIframeOptions & { domPollInterval: number } = {
    domPollInterval: domPollInterval ?? 50,
  }
  if (initialHtmlOrOptions !== undefined) {
    normalized.initialHtml = initialHtmlOrOptions
  }
  return normalized
}

function toAbortError(reason?: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }
  const error = new Error(typeof reason === 'string' ? reason : 'Aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw toAbortError(signal.reason)
  }
}

/**
 * Creates and keeps an invisible iframe while `action` runs, then removes it.
 * No layout impact beyond a briefly attached offscreen/hidden iframe; no navigation
 * of the host page.
 *
 * Observable core aligned with FingerprintJS OSS v5.3.0 `withIframe`, plus optional
 * `timeoutMs` / `signal` for abortable collectors (documented enhancement).
 */
export async function withIframe<T>(
  action: (iframe: HTMLIFrameElement, iWindow: Window) => MaybePromise<T>,
  initialHtmlOrOptions?: string | WithIframeOptions,
  domPollIntervalArg?: number,
): Promise<T> {
  if (!isBrowserEnvironment()) {
    throw new UnsupportedEnvironmentError('Browser environment is required for withIframe')
  }

  const options = normalizeOptions(initialHtmlOrOptions, domPollIntervalArg)
  throwIfAborted(options.signal)

  const timeoutController =
    options.timeoutMs !== undefined && typeof AbortController !== 'undefined'
      ? new AbortController()
      : undefined

  const linked =
    options.signal || timeoutController
      ? linkSignals(options.signal, timeoutController?.signal)
      : undefined

  let timer: ReturnType<typeof setTimeout> | undefined
  if (timeoutController && options.timeoutMs !== undefined) {
    timer = setTimeout(() => {
      timeoutController.abort(new DomOperationTimeoutError())
    }, options.timeoutMs)
  }

  const runOptions: WithIframeOptions & { domPollInterval: number } = {
    ...options,
    domPollInterval: options.domPollInterval,
  }
  if (linked) {
    runOptions.signal = linked
  } else if (options.signal) {
    runOptions.signal = options.signal
  }

  try {
    return await runWithIframe(action, runOptions)
  } catch (error) {
    if (error instanceof DomOperationTimeoutError) {
      throw error
    }
    if (
      timeoutController?.signal.aborted &&
      timeoutController.signal.reason instanceof DomOperationTimeoutError
    ) {
      throw timeoutController.signal.reason
    }
    throw error
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

/** Abort when either signal aborts (prefer first reason). */
function linkSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a && !b) {
    return undefined
  }
  if (a && !b) {
    return a
  }
  if (!a && b) {
    return b
  }
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
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

async function runWithIframe<T>(
  action: (iframe: HTMLIFrameElement, iWindow: Window) => MaybePromise<T>,
  options: WithIframeOptions & { domPollInterval: number },
): Promise<T> {
  const docProbe = getDocument()
  if (docProbe.status !== 'ok') {
    throw new TypeError('document is unavailable for withIframe')
  }
  const d = docProbe.value
  const poll = options.domPollInterval

  while (!d.body) {
    throwIfAborted(options.signal)
    await wait(poll)
  }

  const iframe = d.createElement('iframe')
  // Never set a navigable http(s) URL — about:blank / srcdoc only (no host navigation).
  let abortListener: (() => void) | undefined

  try {
    await new Promise<void>((_resolve, _reject) => {
      let isComplete = false
      const resolve = () => {
        if (isComplete) {
          return
        }
        isComplete = true
        cleanupAbort()
        _resolve()
      }
      const reject = (error: unknown) => {
        if (isComplete) {
          return
        }
        isComplete = true
        cleanupAbort()
        _reject(error)
      }

      const onAbort = () => {
        // Detach immediately so host DOM is not left contaminated if action hangs.
        iframe.parentNode?.removeChild(iframe)
        reject(toAbortError(options.signal?.reason))
      }
      const cleanupAbort = () => {
        if (options.signal && abortListener) {
          options.signal.removeEventListener('abort', abortListener)
          abortListener = undefined
        }
      }
      if (options.signal) {
        abortListener = onAbort
        options.signal.addEventListener('abort', onAbort)
        if (options.signal.aborted) {
          onAbort()
          return
        }
      }

      iframe.onload = () => resolve()
      iframe.onerror = () => reject(new Error('iframe failed to load'))

      const { style } = iframe
      // display:block important — required for browsers to calculate layout inside.
      style.setProperty('display', 'block', 'important')
      style.position = 'absolute'
      style.top = '0'
      style.left = '0'
      style.visibility = 'hidden'
      // Keep out of normal flow / hit-testing as much as practical.
      style.pointerEvents = 'none'
      style.width = '0'
      style.height = '0'
      style.border = '0'
      style.opacity = '0'

      if (options.initialHtml && 'srcdoc' in iframe) {
        iframe.srcdoc = options.initialHtml
      } else {
        iframe.src = 'about:blank'
      }
      d.body.appendChild(iframe)

      // WebKit in WeChat may not fire iframe `onload` — poll readyState (FPJS #645).
      const checkReadyState = () => {
        if (isComplete) {
          return
        }
        if (iframe.contentWindow?.document?.readyState === 'complete') {
          resolve()
        } else {
          setTimeout(checkReadyState, 10)
        }
      }
      checkReadyState()
    })

    while (!iframe.contentWindow?.document?.body) {
      throwIfAborted(options.signal)
      await wait(poll)
    }

    throwIfAborted(options.signal)
    const iWindow = iframe.contentWindow as Window
    const actionResult = Promise.resolve().then(() => action(iframe, iWindow))
    if (!options.signal) {
      return await actionResult
    }
    return await raceAbort(actionResult, options.signal)
  } finally {
    if (options.signal && abortListener) {
      options.signal.removeEventListener('abort', abortListener)
    }
    iframe.parentNode?.removeChild(iframe)
  }
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(toAbortError(signal.reason))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(toAbortError(signal.reason))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
