import type { MaybePromise, Source } from '@night-watch/core'
import { SourceTimeoutError } from './errors.js'
import { throwIfAborted, toAbortError, type TimerRegistry } from './timers.js'
import type { ResolvedCollectionBudget } from './types.js'

function isDeferredGetter<T>(
  value: T | (() => MaybePromise<T>),
): value is () => MaybePromise<T> {
  return typeof value === 'function'
}

async function raceStage<T>(
  work: () => MaybePromise<T>,
  sourceKey: string,
  stage: 'load' | 'get',
  signal: AbortSignal | undefined,
  perSourceTimeoutMs: number | undefined,
  timers: TimerRegistry,
): Promise<T> {
  throwIfAborted(signal)

  const pending: Promise<T>[] = [Promise.resolve().then(work)]

  let timeoutHandle: ReturnType<TimerRegistry['schedule']> | undefined
  if (perSourceTimeoutMs !== undefined) {
    pending.push(
      new Promise<T>((_, reject) => {
        timeoutHandle = timers.schedule(() => {
          reject(new SourceTimeoutError(sourceKey, perSourceTimeoutMs, stage))
        }, perSourceTimeoutMs)
      }),
    )
  }

  let abortHandler: (() => void) | undefined
  if (signal) {
    pending.push(
      new Promise<T>((_, reject) => {
        abortHandler = () => reject(toAbortError(signal.reason))
        if (signal.aborted) {
          abortHandler()
          return
        }
        signal.addEventListener('abort', abortHandler, { once: true })
      }),
    )
  }

  try {
    return await Promise.race(pending)
  } finally {
    timeoutHandle?.clear()
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler)
    }
  }
}

/**
 * Wraps each source so load/get stages honor abort + per-source timeouts.
 * Failures propagate as thrown errors → loadSource records error components
 * (never silent fake success values).
 */
export function wrapSourcesWithBudget<TOptions>(
  sources: Record<string, Source<TOptions, unknown>>,
  budget: ResolvedCollectionBudget,
  linkedSignal: AbortSignal | undefined,
  timers: TimerRegistry,
): Record<string, Source<TOptions, unknown>> {
  const wrapped: Record<string, Source<TOptions, unknown>> = {}

  for (const key of Object.keys(sources)) {
    const original = sources[key]!
    wrapped[key] = ((options: TOptions) => {
      return raceStage(
        () => original(options),
        key,
        'load',
        linkedSignal,
        budget.perSourceTimeoutMs,
        timers,
      ).then((loadResult) => {
        if (!isDeferredGetter(loadResult)) {
          return loadResult
        }
        return () =>
          raceStage(
            () => loadResult(),
            key,
            'get',
            linkedSignal,
            budget.perSourceTimeoutMs,
            timers,
          )
      })
    }) as Source<TOptions, unknown>
  }

  return wrapped
}
