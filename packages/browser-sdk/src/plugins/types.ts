import type { BuiltinSourceOptions, Component, MaybePromise, UnknownComponents } from '@thenightwatch/core'

/** Versioned plugin SDK catalog (independent of `SOURCE_MANIFEST_REVISION`). */
export const PLUGIN_SDK_REVISION = 'night-watch-plugin-sdk-v1' as const

export type PluginSdkRevision = typeof PLUGIN_SDK_REVISION

/** Default required prefix so custom keys cannot silently collide with builtins. */
export const DEFAULT_PLUGIN_KEY_PREFIX = 'ext:' as const

export type PluginCollectStage = 'load' | 'get'

/**
 * Explicit opt-in policy for plugin registration and execution.
 * Defaults are restrictive: namespaced keys, no builtin overwrite, no network claim.
 */
export type PluginPolicy = {
  /**
   * Required key prefix (default `ext:`). Empty string disables the prefix check
   * (still forbids `applePay` and builtin collisions unless overwrite is allowed).
   */
  readonly requiredKeyPrefix?: string
  /** When true, a plugin may replace a builtin key of the same name. Default false. */
  readonly allowOverwriteBuiltins?: boolean
  /** Cap for per-plugin `timeoutMs` (default 5000). */
  readonly maxTimeoutMs?: number
  /** Applied when a plugin omits `timeoutMs` (default 2000). */
  readonly defaultTimeoutMs?: number
  /**
   * Disclosure flag only — the SDK does not open network sockets for plugins.
   * Integrators must keep `allowNetwork: false` unless their plugin code itself
   * performs first-party fetches (discouraged; document beside stored IDs).
   */
  readonly allowNetwork?: boolean
}

export type ResolvedPluginPolicy = {
  readonly requiredKeyPrefix: string
  readonly allowOverwriteBuiltins: boolean
  readonly maxTimeoutMs: number
  readonly defaultTimeoutMs: number
  readonly allowNetwork: boolean
}

/**
 * Context passed to a plugin collector.
 * `deps` holds successfully collected dependency values (plugin or builtin keys).
 * Failed dependencies appear in `depComponents` as error arms and are omitted from `deps`.
 */
export type PluginCollectContext = {
  readonly stage: PluginCollectStage
  readonly signal: AbortSignal
  readonly options: BuiltinSourceOptions
  readonly componentsSoFar: Readonly<UnknownComponents>
  readonly deps: Readonly<Record<string, unknown>>
  readonly depComponents: Readonly<Record<string, Component<unknown>>>
}

export type PluginCleanupReason = 'success' | 'error' | 'timeout' | 'abort'

export type PluginCleanupContext = {
  readonly reason: PluginCleanupReason
  readonly key: string
  readonly pluginId: string
}

/**
 * Typed custom entropy plugin.
 * `key` becomes the component map key (must be namespaced under policy).
 * `collect` may return a value or a phase-2 deferred getter (same shape as builtin sources).
 */
export type PluginDefinition<TValue = unknown> = {
  /** Stable plugin identity for manifests (not necessarily equal to `key`). */
  readonly id: string
  /** Component key written into the result map. */
  readonly key: string
  /** Semver-ish plugin version string for ops diffs. */
  readonly version: string
  /** Component keys that must be collected before this plugin runs. */
  readonly dependsOn?: readonly string[]
  /** Per-plugin budget; clamped by policy `maxTimeoutMs`. */
  readonly timeoutMs?: number
  /**
   * When true (default), collected values must be `JSON.stringify`-able.
   * Non-JSON values become an error component (never silent).
   */
  readonly jsonSafe?: boolean
  readonly collect: (
    ctx: PluginCollectContext,
  ) => MaybePromise<TValue | (() => MaybePromise<TValue>)>
  /** Optional resource cleanup (DOM nodes, contexts). Always invoked once per run. */
  readonly cleanup?: (ctx: PluginCleanupContext) => void | Promise<void>
}

export type PluginManifestEntry = {
  readonly id: string
  readonly key: string
  readonly version: string
  readonly dependsOn: readonly string[]
  readonly timeoutMs: number
  readonly jsonSafe: boolean
}

export type PluginManifest = {
  readonly revision: PluginSdkRevision
  readonly policy: ResolvedPluginPolicy
  readonly plugins: readonly PluginManifestEntry[]
  readonly executionOrder: readonly string[]
  readonly notes: readonly string[]
}

export type PluginResolution = {
  readonly manifest: PluginManifest
  /** True whenever any plugin key is present (extends beyond default-profile 41). */
  readonly visitorIdWillDifferFromFullDefault: boolean
  readonly pluginKeys: readonly string[]
}
