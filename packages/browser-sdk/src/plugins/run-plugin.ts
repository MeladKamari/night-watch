import type { BuiltinSourceOptions, Component, MaybePromise, UnknownComponents } from '@thenightwatch/core'
import {
  PluginAbortError,
  PluginJsonSafetyError,
  PluginTimeoutError,
} from './errors.js'
import { clampPluginTimeout } from './validate.js'
import type {
  PluginCleanupReason,
  PluginDefinition,
  PluginCollectContext,
  ResolvedPluginPolicy,
} from './types.js'

function isDeferredGetter<T>(
  value: T | (() => MaybePromise<T>),
): value is () => MaybePromise<T> {
  return typeof value === 'function'
}

function assertJsonSafe(value: unknown, pluginKey: string): void {
  try {
    const encoded = JSON.stringify(value)
    if (value === undefined || encoded === undefined) {
      throw new PluginJsonSafetyError(
        `Plugin "${pluginKey}" produced a value that is not JSON-safe for hashing`,
      )
    }
  } catch (error) {
    if (error instanceof PluginJsonSafetyError) throw error
    throw new PluginJsonSafetyError(
      `Plugin "${pluginKey}" produced a non-JSON-serializable value`,
    )
  }
}

function buildDeps(
  dependsOn: readonly string[],
  componentsSoFar: UnknownComponents,
): {
  deps: Record<string, unknown>
  depComponents: Record<string, Component<unknown>>
} {
  const deps: Record<string, unknown> = {}
  const depComponents: Record<string, Component<unknown>> = {}
  for (const key of dependsOn) {
    const component = componentsSoFar[key]
    if (component === undefined) continue
    depComponents[key] = component
    if ('value' in component) {
      deps[key] = component.value
    }
  }
  return { deps, depComponents }
}

function inertAbortSignal(): AbortSignal {
  if (typeof AbortController !== 'undefined') {
    return new AbortController().signal
  }
  // Legacy / non-DOM test hosts: provide the fields collectors typically read.
  return { aborted: false } as AbortSignal
}

async function runWithTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  pluginKey: string,
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  const signal = controller?.signal ?? inertAbortSignal()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort()
      reject(new PluginTimeoutError(pluginKey, timeoutMs))
    }, timeoutMs)
  })

  try {
    return await Promise.race([work(signal), timeoutPromise])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function invokeCollect(
  plugin: PluginDefinition,
  ctx: PluginCollectContext,
): Promise<unknown> {
  if (ctx.signal.aborted) {
    throw new PluginAbortError(`Plugin "${plugin.key}" aborted before collect`)
  }
  const loadResult = await plugin.collect({ ...ctx, stage: 'load' })
  if (!isDeferredGetter(loadResult)) {
    return loadResult
  }
  if (ctx.signal.aborted) {
    throw new PluginAbortError(`Plugin "${plugin.key}" aborted before get stage`)
  }
  return loadResult()
}

async function safeCleanup(
  plugin: PluginDefinition,
  reason: PluginCleanupReason,
): Promise<void> {
  if (!plugin.cleanup) return
  try {
    await plugin.cleanup({ reason, key: plugin.key, pluginId: plugin.id })
  } catch {
    // Cleanup failures must not mask the primary collect outcome.
  }
}

/**
 * Runs one plugin with timeout budget, JSON safety, two-stage collect, and cleanup.
 * Failures become error components (isolation — other plugins still run).
 */
export async function runSinglePlugin(
  plugin: PluginDefinition,
  componentsSoFar: UnknownComponents,
  options: BuiltinSourceOptions,
  policy: ResolvedPluginPolicy,
): Promise<Component<unknown>> {
  const timeoutMs = clampPluginTimeout(plugin, policy)
  const dependsOn = plugin.dependsOn ?? []
  const { deps, depComponents } = buildDeps(dependsOn, componentsSoFar)
  const started = Date.now()
  let reason: PluginCleanupReason = 'success'

  try {
    const value = await runWithTimeout(
      async (signal) => {
        const ctx: PluginCollectContext = {
          stage: 'load',
          signal,
          options,
          componentsSoFar,
          deps,
          depComponents,
        }
        return invokeCollect(plugin, ctx)
      },
      timeoutMs,
      plugin.key,
    )

    if (plugin.jsonSafe !== false) {
      assertJsonSafe(value, plugin.key)
    }

    return { value, duration: Date.now() - started }
  } catch (error) {
    if (error instanceof PluginTimeoutError) {
      reason = 'timeout'
    } else if (error instanceof PluginAbortError) {
      reason = 'abort'
    } else {
      reason = 'error'
    }
    return { error, duration: Date.now() - started }
  } finally {
    await safeCleanup(plugin, reason)
  }
}

/**
 * Executes plugins in topological order, mutating a copy of the component map.
 */
export async function runPluginsInOrder(
  ordered: readonly PluginDefinition[],
  baseComponents: UnknownComponents,
  options: BuiltinSourceOptions,
  policy: ResolvedPluginPolicy,
): Promise<UnknownComponents> {
  const components: UnknownComponents = { ...baseComponents }
  for (const plugin of ordered) {
    components[plugin.key] = await runSinglePlugin(plugin, components, options, policy)
  }
  return components
}
