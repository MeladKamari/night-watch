import {
  assertBrowserEnvironment,
  loadSources,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type UnknownComponents,
} from '@thenightwatch/core'
import {
  createAgent,
  handleMonitoringOption,
  prepareForSources,
  type LoadAgentOptions,
} from '../agent.js'
import { mergeBuiltinSources } from '../sources/merge-sources.js'
import type { Agent } from '../types.js'
import { resolvePlugins } from './resolve-plugins.js'
import { runPluginsInOrder } from './run-plugin.js'
import type { PluginDefinition, PluginPolicy, PluginResolution } from './types.js'

const DEFAULT_DELAY_FALLBACK_MS = 50

export type LoadWithPluginsOptions = LoadAgentOptions & {
  /** Required opt-in plugin list. Default {@link import('../agent.js').load} ignores plugins. */
  readonly plugins: readonly PluginDefinition[]
  /** Explicit plugin policy (namespacing, timeouts, overwrite rules). */
  readonly pluginPolicy?: PluginPolicy
}

export type LoadWithPluginsResult = {
  readonly agent: Agent
  readonly resolution: PluginResolution
}

/**
 * Opt-in loader: runs Default-profile builtins (or overrides), then executes typed
 * plugins in dependency order with timeout budgets and cleanup hooks.
 *
 * Default {@link import('../agent.js').load} behavior is unchanged when this
 * function is not used. Plugin keys always extend the component map, so
 * `visitorId` differs from the 41-source default.
 */
export async function loadWithPlugins(
  options: LoadWithPluginsOptions,
): Promise<LoadWithPluginsResult> {
  const { plugins, pluginPolicy, ...loadOptions } = options
  const { ordered, resolution } = resolvePlugins(plugins, pluginPolicy)

  const delayFallback = loadOptions.delayFallback ?? DEFAULT_DELAY_FALLBACK_MS
  const debug = loadOptions.debug === true
  const monitoring = loadOptions.monitoring === true

  handleMonitoringOption(monitoring)

  const hasCollectableRegistry =
    loadOptions.sources !== undefined || loadOptions.customSources !== undefined
  // Test hosts may pass allowNonBrowser with an explicit sources map and/or plugins.
  const allowNonBrowser =
    loadOptions.allowNonBrowser === true &&
    (hasCollectableRegistry || ordered.length > 0)
  if (!allowNonBrowser) {
    assertBrowserEnvironment()
  }

  await prepareForSources(delayFallback)

  const sources: BuiltinSources =
    loadOptions.sources ??
    mergeBuiltinSources(loadOptions.customSources ?? {}, {
      overwriteBuiltins: loadOptions.overwriteBuiltins === true,
    })

  // When allowNonBrowser and only plugins matter for a unit test, sources may be
  // an empty custom map via `sources: {} as BuiltinSources` — callers control that.
  const excludeSources = loadOptions.excludeSources ?? []
  const sourceOptions: BuiltinSourceOptions = { cache: {}, debug }
  const getBuiltins = loadSources(sources, sourceOptions, excludeSources)

  const getComponents = async (): Promise<UnknownComponents> => {
    const base = (await getBuiltins()) as UnknownComponents
    return runPluginsInOrder(ordered, base, sourceOptions, resolution.manifest.policy)
  }

  const agent = createAgent(getComponents, { debug })
  return { agent, resolution }
}
