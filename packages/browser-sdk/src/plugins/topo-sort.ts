import { PluginDependencyError } from './errors.js'
import type { PluginDefinition } from './types.js'

/**
 * Kahn topological sort by plugin `key`.
 * Dependencies may reference builtin keys (ignored for ordering edges among plugins)
 * or other plugin keys (ordering edges).
 */
export function topoSortPlugins(
  plugins: readonly PluginDefinition[],
): PluginDefinition[] {
  const byKey = new Map<string, PluginDefinition>()
  for (const plugin of plugins) {
    byKey.set(plugin.key, plugin)
  }

  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const plugin of plugins) {
    indegree.set(plugin.key, 0)
    dependents.set(plugin.key, [])
  }

  for (const plugin of plugins) {
    for (const dep of plugin.dependsOn ?? []) {
      if (!byKey.has(dep)) {
        // Builtin or external key — satisfied at runtime from componentsSoFar.
        continue
      }
      indegree.set(plugin.key, (indegree.get(plugin.key) ?? 0) + 1)
      dependents.get(dep)!.push(plugin.key)
    }
  }

  const queue: string[] = []
  for (const [key, degree] of indegree) {
    if (degree === 0) queue.push(key)
  }

  const ordered: PluginDefinition[] = []
  while (queue.length > 0) {
    const key = queue.shift()!
    ordered.push(byKey.get(key)!)
    for (const next of dependents.get(key) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1
      indegree.set(next, nextDegree)
      if (nextDegree === 0) queue.push(next)
    }
  }

  if (ordered.length !== plugins.length) {
    const remaining = plugins
      .map((p) => p.key)
      .filter((k) => !ordered.some((o) => o.key === k))
    throw new PluginDependencyError(
      `Plugin dependency cycle detected among: ${remaining.join(', ')}`,
    )
  }

  return ordered
}
