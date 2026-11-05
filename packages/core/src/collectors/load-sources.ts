import { mapWithBreaks, suppressUnhandledRejectionWarning } from '../scheduler/index.js'
import type { Component, Source, SourcesToComponents } from '../types.js'
import { excludes } from './excludes.js'
import { loadSource } from './load-source.js'

/**
 * Loads entropy sources. Returns a function that collects components.
 *
 * Returned synchronously so component collection can start before all sources
 * finish their load stage. Preserves source key insertion order in the result.
 *
 * @param loopReleaseInterval - Cooperative yield interval (ms) for dense sync work.
 */
export function loadSources<
  TSourceOptions,
  TSources extends Record<string, Source<TSourceOptions, unknown>>,
  TExclude extends string,
>(
  sources: TSources,
  sourceOptions: TSourceOptions,
  excludeSources: readonly TExclude[],
  loopReleaseInterval?: number,
): () => Promise<Omit<SourcesToComponents<TSources>, TExclude>> {
  const includedSources = Object.keys(sources).filter((sourceKey) =>
    excludes(excludeSources, sourceKey),
  ) as Array<Exclude<keyof TSources & string, TExclude>>

  const sourceGettersPromise = suppressUnhandledRejectionWarning(
    mapWithBreaks(
      includedSources,
      (sourceKey) => {
        const source = sources[sourceKey]
        return loadSource(source as Source<TSourceOptions, unknown>, sourceOptions)
      },
      loopReleaseInterval,
    ),
  )

  return async function getComponents() {
    const sourceGetters = await sourceGettersPromise

    const componentPromises = await mapWithBreaks(
      sourceGetters,
      (sourceGetter) => suppressUnhandledRejectionWarning(sourceGetter()),
      loopReleaseInterval,
    )

    const componentArray = await Promise.all(componentPromises)
    const components = {} as Omit<SourcesToComponents<TSources>, TExclude>
    for (let index = 0; index < includedSources.length; ++index) {
      const key = includedSources[index] as Exclude<keyof TSources & string, TExclude>
      components[key] = componentArray[index] as Component<unknown> as Omit<
        SourcesToComponents<TSources>,
        TExclude
      >[typeof key]
    }

    return components
  }
}
