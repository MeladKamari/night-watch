import { awaitIfAsync, suppressUnhandledRejectionWarning } from '../scheduler/index.js'
import type { Component, MaybePromise, Source } from '../types.js'

function isFinalResultLoaded<TValue>(
  loadResult: TValue | (() => MaybePromise<TValue>),
): loadResult is TValue {
  return typeof loadResult !== 'function'
}

/**
 * Loads a single entropy source. Returns a function that gets the component.
 *
 * The getter is returned **synchronously** so {@link loadSources} can start other
 * sources without waiting for this one to finish loading.
 */
export function loadSource<TOptions, TValue>(
  source: Source<TOptions, TValue>,
  sourceOptions: TOptions,
): () => Promise<Component<TValue>> {
  const sourceLoadPromise = suppressUnhandledRejectionWarning(
    new Promise<() => MaybePromise<Component<TValue>>>((resolveLoad) => {
      const loadStartTime = Date.now()

      // `awaitIfAsync` keeps sync duration measurement accurate (no forced microtask).
      awaitIfAsync(source.bind(null, sourceOptions), (...loadArgs) => {
        const loadDuration = Date.now() - loadStartTime

        if (!loadArgs[0]) {
          return resolveLoad(() => ({ error: loadArgs[1], duration: loadDuration }))
        }

        const loadResult = loadArgs[1]

        if (isFinalResultLoaded(loadResult)) {
          return resolveLoad(() => ({ value: loadResult, duration: loadDuration }))
        }

        // Phase-2 deferred getter
        resolveLoad(
          () =>
            new Promise<Component<TValue>>((resolveGet) => {
              const getStartTime = Date.now()

              awaitIfAsync(loadResult, (...getArgs) => {
                const duration = loadDuration + Date.now() - getStartTime

                if (!getArgs[0]) {
                  return resolveGet({ error: getArgs[1], duration })
                }

                resolveGet({ value: getArgs[1], duration })
              })
            }),
        )
      })
    }),
  )

  return function getComponent() {
    return sourceLoadPromise.then((finalizeSource) => finalizeSource())
  }
}
