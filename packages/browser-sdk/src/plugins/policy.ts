import {
  DEFAULT_PLUGIN_KEY_PREFIX,
  type PluginPolicy,
  type ResolvedPluginPolicy,
} from './types.js'

const DEFAULT_MAX_TIMEOUT_MS = 5000
const DEFAULT_TIMEOUT_MS = 2000

export function resolvePluginPolicy(policy: PluginPolicy = {}): ResolvedPluginPolicy {
  const maxTimeoutMs =
    policy.maxTimeoutMs === undefined ? DEFAULT_MAX_TIMEOUT_MS : policy.maxTimeoutMs
  const defaultTimeoutMs =
    policy.defaultTimeoutMs === undefined ? DEFAULT_TIMEOUT_MS : policy.defaultTimeoutMs

  if (!Number.isFinite(maxTimeoutMs) || maxTimeoutMs <= 0) {
    throw new TypeError('pluginPolicy.maxTimeoutMs must be a positive finite number')
  }
  if (!Number.isFinite(defaultTimeoutMs) || defaultTimeoutMs <= 0) {
    throw new TypeError('pluginPolicy.defaultTimeoutMs must be a positive finite number')
  }
  if (defaultTimeoutMs > maxTimeoutMs) {
    throw new TypeError('pluginPolicy.defaultTimeoutMs cannot exceed maxTimeoutMs')
  }

  return {
    requiredKeyPrefix:
      policy.requiredKeyPrefix === undefined
        ? DEFAULT_PLUGIN_KEY_PREFIX
        : policy.requiredKeyPrefix,
    allowOverwriteBuiltins: policy.allowOverwriteBuiltins === true,
    maxTimeoutMs,
    defaultTimeoutMs,
    allowNetwork: policy.allowNetwork === true,
  }
}
