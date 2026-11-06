import {
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  type EnabledSourceName,
} from '@thenightwatch/core'
import { PluginRegistrationError } from './errors.js'
import type { PluginDefinition, ResolvedPluginPolicy } from './types.js'

const BUILTIN_SET = new Set<string>(ENABLED_SOURCES)

export function isBuiltinSourceKey(key: string): key is EnabledSourceName {
  return BUILTIN_SET.has(key)
}

/**
 * Validates plugin registration against policy before any collector runs.
 * Never allows `applePay`. Enforces namespacing, uniqueness, and timeout caps.
 */
export function validatePlugins(
  plugins: readonly PluginDefinition[],
  policy: ResolvedPluginPolicy,
): PluginDefinition[] {
  if (!Array.isArray(plugins)) {
    throw new TypeError('plugins must be an array')
  }
  if (plugins.length === 0) {
    throw new PluginRegistrationError(
      'loadWithPlugins requires at least one plugin definition (otherwise use load())',
    )
  }

  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const normalized: PluginDefinition[] = []

  for (const plugin of plugins) {
    if (plugin == null || typeof plugin !== 'object') {
      throw new PluginRegistrationError('Each plugin must be an object')
    }
    const id = String(plugin.id ?? '').trim()
    const key = String(plugin.key ?? '').trim()
    const version = String(plugin.version ?? '').trim()

    if (!id) {
      throw new PluginRegistrationError('Plugin id is required')
    }
    if (!key) {
      throw new PluginRegistrationError(`Plugin "${id}" is missing key`)
    }
    if (!version) {
      throw new PluginRegistrationError(`Plugin "${id}" is missing version`)
    }
    if (typeof plugin.collect !== 'function') {
      throw new PluginRegistrationError(`Plugin "${id}" collect must be a function`)
    }
    if (key === EXCLUDED_UPSTREAM_SOURCE || id === EXCLUDED_UPSTREAM_SOURCE) {
      throw new PluginRegistrationError(
        `Plugins must not register excluded upstream key "${EXCLUDED_UPSTREAM_SOURCE}"`,
      )
    }
    if (isBuiltinSourceKey(key) && !policy.allowOverwriteBuiltins) {
      throw new PluginRegistrationError(
        `Plugin key "${key}" collides with a builtin source; set allowOverwriteBuiltins or use a namespaced key`,
      )
    }
    if (policy.requiredKeyPrefix && !key.startsWith(policy.requiredKeyPrefix)) {
      throw new PluginRegistrationError(
        `Plugin key "${key}" must start with required prefix "${policy.requiredKeyPrefix}"`,
      )
    }
    if (seenIds.has(id)) {
      throw new PluginRegistrationError(`Duplicate plugin id "${id}"`)
    }
    if (seenKeys.has(key)) {
      throw new PluginRegistrationError(`Duplicate plugin key "${key}" (name collision)`)
    }
    if (plugin.timeoutMs !== undefined) {
      if (!Number.isFinite(plugin.timeoutMs) || plugin.timeoutMs <= 0) {
        throw new PluginRegistrationError(
          `Plugin "${id}" timeoutMs must be a positive finite number`,
        )
      }
      if (plugin.timeoutMs > policy.maxTimeoutMs) {
        throw new PluginRegistrationError(
          `Plugin "${id}" timeoutMs ${plugin.timeoutMs} exceeds policy maxTimeoutMs ${policy.maxTimeoutMs}`,
        )
      }
    }
    for (const dep of plugin.dependsOn ?? []) {
      if (typeof dep !== 'string' || !dep.trim()) {
        throw new PluginRegistrationError(`Plugin "${id}" has an invalid dependsOn entry`)
      }
      if (dep === EXCLUDED_UPSTREAM_SOURCE) {
        throw new PluginRegistrationError(
          `Plugin "${id}" must not depend on "${EXCLUDED_UPSTREAM_SOURCE}"`,
        )
      }
    }

    seenIds.add(id)
    seenKeys.add(key)
    normalized.push({
      ...plugin,
      id,
      key,
      version,
      dependsOn: [...(plugin.dependsOn ?? [])],
      jsonSafe: plugin.jsonSafe !== false,
    })
  }

  // Self-deps and unknown plugin deps are OK if they refer to builtins; self-cycle caught in topo.
  for (const plugin of normalized) {
    for (const dep of plugin.dependsOn ?? []) {
      if (dep === plugin.key) {
        throw new PluginRegistrationError(
          `Plugin "${plugin.id}" cannot depend on its own key "${plugin.key}"`,
        )
      }
    }
  }

  return normalized
}

export function clampPluginTimeout(
  plugin: PluginDefinition,
  policy: ResolvedPluginPolicy,
): number {
  const raw = plugin.timeoutMs ?? policy.defaultTimeoutMs
  return Math.min(raw, policy.maxTimeoutMs)
}
