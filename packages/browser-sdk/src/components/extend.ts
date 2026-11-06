import type { Component, UnknownComponents } from '@thenightwatch/core'

export type ExtendComponentsOptions = {
  /**
   * When false (default), keys that already exist in `base` are left unchanged.
   * When true, `additions` replace colliding keys.
   */
  overwrite?: boolean
}

/**
 * Returns a shallow copy of `components` without the listed keys.
 * Preserves relative insertion order of remaining keys.
 * Missing keys are ignored (idempotent).
 */
export function omitComponents<T extends UnknownComponents>(
  components: T,
  keys: readonly string[],
): UnknownComponents {
  const drop = new Set(keys)
  const result: UnknownComponents = {}
  for (const key of Object.keys(components)) {
    if (!drop.has(key)) {
      result[key] = components[key]!
    }
  }
  return result
}

/**
 * Adds component entries to a map.
 * By default does **not** override existing keys (safe for built-ins).
 * Error components and value components are accepted as-is.
 */
export function extendComponents(
  base: UnknownComponents,
  additions: UnknownComponents,
  options: ExtendComponentsOptions = {},
): UnknownComponents {
  const overwrite = options.overwrite === true
  const result: UnknownComponents = { ...base }
  for (const key of Object.keys(additions)) {
    if (!overwrite && Object.prototype.hasOwnProperty.call(result, key)) {
      continue
    }
    result[key] = additions[key]!
  }
  return result
}

/**
 * Convenience: add a single named component (value or error arm).
 * Does not overwrite by default.
 */
export function withComponent(
  base: UnknownComponents,
  key: string,
  component: Component<unknown>,
  options: ExtendComponentsOptions = {},
): UnknownComponents {
  return extendComponents(base, { [key]: component }, options)
}
