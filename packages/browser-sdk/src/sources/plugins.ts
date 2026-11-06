import { getNavigator, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

export type PluginMimeTypeData = {
  type: string
  suffixes: string
}

export type PluginData = {
  name: string
  description: string
  mimeTypes: PluginMimeTypeData[]
}

/** Minimal PluginArray-like surface (Safari 10: index loop, not for...of). */
export type PluginArrayLike = {
  readonly length: number
  [index: number]: PluginLike | null | undefined
}

export type PluginLike = {
  readonly name: string
  readonly description: string
  readonly length: number
  [index: number]: MimeTypeLike | null | undefined
}

export type MimeTypeLike = {
  readonly type: string
  readonly suffixes: string
}

export type PluginsOptions = {
  /** Inject plugins list for tests (skips live `navigator.plugins`). */
  plugins?: PluginArrayLike | null
}

/**
 * Normalizes `navigator.plugins` into a JSON-serializable array.
 * Preserves source order; skips null entries; never executes plugins.
 * Returns `undefined` when the plugins collection is absent.
 */
export function getPluginsValue(options: PluginsOptions = {}): PluginData[] | undefined {
  const rawPlugins = resolvePlugins(options)
  if (!rawPlugins) {
    return undefined
  }
  return collectPlugins(rawPlugins)
}

function resolvePlugins(options: PluginsOptions): PluginArrayLike | null | undefined {
  if ('plugins' in options) {
    return options.plugins
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return (navProbe.value as Navigator & { plugins?: PluginArrayLike | null }).plugins
}

export function collectPlugins(rawPlugins: PluginArrayLike): PluginData[] {
  const plugins: PluginData[] = []

  // Safari 10 doesn't support iterating navigator.plugins with for...of
  for (let i = 0; i < rawPlugins.length; ++i) {
    const plugin = rawPlugins[i]
    if (!plugin) {
      continue
    }

    const mimeTypes: PluginMimeTypeData[] = []
    for (let j = 0; j < plugin.length; ++j) {
      const mimeType = plugin[j]!
      mimeTypes.push({
        type: mimeType.type,
        suffixes: mimeType.suffixes,
      })
    }

    plugins.push({
      name: plugin.name,
      description: plugin.description,
      mimeTypes,
    })
  }

  return plugins
}

/** Entropy source: navigator plugins metadata (serializable; no plugin execution). */
export const getPlugins: Source<BuiltinSourceOptions, PluginData[] | undefined> = () =>
  getPluginsValue()
