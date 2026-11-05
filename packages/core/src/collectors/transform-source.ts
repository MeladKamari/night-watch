import { isPromise } from '../scheduler/index.js'
import type { MaybePromise, Source } from '../types.js'

function isFinalResultLoaded<TValue>(
  loadResult: TValue | (() => MaybePromise<TValue>),
): loadResult is TValue {
  return typeof loadResult !== 'function'
}

/**
 * Wraps a source by transforming its resolved value while preserving
 * sync/async and one-/two-stage behavior.
 */
export function transformSource<TOptions, TValueBefore, TValueAfter>(
  source: Source<TOptions, TValueBefore>,
  transformValue: (value: TValueBefore) => TValueAfter,
): Source<TOptions, TValueAfter> {
  const transformLoadResult = (
    loadResult: TValueBefore | (() => MaybePromise<TValueBefore>),
  ): TValueAfter | (() => MaybePromise<TValueAfter>) => {
    if (isFinalResultLoaded(loadResult)) {
      return transformValue(loadResult)
    }

    return () => {
      const getResult = loadResult()

      if (isPromise(getResult)) {
        return getResult.then(transformValue)
      }

      return transformValue(getResult)
    }
  }

  return (options) => {
    const loadResult = source(options)

    if (isPromise(loadResult)) {
      return loadResult.then(transformLoadResult)
    }

    return transformLoadResult(loadResult)
  }
}
