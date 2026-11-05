import { resolvePluginPolicy } from './policy.js'
import { topoSortPlugins } from './topo-sort.js'
import { clampPluginTimeout, validatePlugins } from './validate.js'
import {
  PLUGIN_SDK_REVISION,
  type PluginDefinition,
  type PluginManifest,
  type PluginPolicy,
  type PluginResolution,
} from './types.js'

/**
 * Validates plugins, applies policy, topo-sorts, and builds a diffable manifest.
 * Does not start collectors.
 */
export function resolvePlugins(
  plugins: readonly PluginDefinition[],
  policyInput: PluginPolicy = {},
): {
  readonly ordered: PluginDefinition[]
  readonly resolution: PluginResolution
} {
  const policy = resolvePluginPolicy(policyInput)
  const validated = validatePlugins(plugins, policy)
  const ordered = topoSortPlugins(validated)

  const manifest: PluginManifest = {
    revision: PLUGIN_SDK_REVISION,
    policy,
    plugins: validated.map((plugin) => ({
      id: plugin.id,
      key: plugin.key,
      version: plugin.version,
      dependsOn: [...(plugin.dependsOn ?? [])],
      timeoutMs: clampPluginTimeout(plugin, policy),
      jsonSafe: plugin.jsonSafe !== false,
    })),
    executionOrder: ordered.map((plugin) => plugin.key),
    notes: [
      `Plugin SDK ${PLUGIN_SDK_REVISION}; default-profile 41-source registry unchanged.`,
      'Opt-in only — default load() never registers plugins.',
      'Adding plugin keys changes visitorId vs full default-profile (documented).',
      policy.allowNetwork
        ? 'Policy allowNetwork=true: integrator-owned fetches only; SDK opens no sockets.'
        : 'Policy allowNetwork=false: plugins must not perform network I/O.',
    ],
  }

  return {
    ordered,
    resolution: {
      manifest,
      visitorIdWillDifferFromFullDefault: true,
      pluginKeys: ordered.map((plugin) => plugin.key),
    },
  }
}

/** Stable JSON form for manifest diffs / snapshots. */
export function pluginManifestToJson(manifest: PluginManifest): string {
  return `${JSON.stringify(
    {
      revision: manifest.revision,
      policy: manifest.policy,
      plugins: manifest.plugins,
      executionOrder: manifest.executionOrder,
    },
    null,
    2,
  )}\n`
}
