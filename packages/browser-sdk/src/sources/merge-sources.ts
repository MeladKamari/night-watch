import {
  EXCLUDED_UPSTREAM_SOURCE,
  RegistryInvariantError,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
  type UnknownSources,
} from '@night-watch/core'
import { createBuiltinSources } from './builtin.js'

export type MergeSourcesOptions = {
  /**
   * When false (default), custom keys that collide with built-ins are ignored.
   * When true, custom sources replace built-ins of the same name.
   */
  overwriteBuiltins?: boolean
}

/**
 * Merges Default-profile built-ins with optional custom sources.
 * Never registers the excluded upstream payment key (`applePay`).
 * Custom sources are appended after built-ins when new (preserves builtin order).
 */
export function mergeBuiltinSources(
  custom: UnknownSources<BuiltinSourceOptions> = {},
  options: MergeSourcesOptions = {},
): BuiltinSources & UnknownSources<BuiltinSourceOptions> {
  if (Object.prototype.hasOwnProperty.call(custom, EXCLUDED_UPSTREAM_SOURCE)) {
    throw new RegistryInvariantError(
      `Custom sources must not register excluded upstream key "${EXCLUDED_UPSTREAM_SOURCE}"`,
    )
  }

  const overwrite = options.overwriteBuiltins === true
  const builtins = createBuiltinSources()
  const merged: Record<string, Source<BuiltinSourceOptions, unknown>> = { ...builtins }

  for (const key of Object.keys(custom)) {
    if (Object.prototype.hasOwnProperty.call(builtins, key) && !overwrite) {
      continue
    }
    merged[key] = custom[key] as Source<BuiltinSourceOptions, unknown>
  }

  return merged as BuiltinSources & UnknownSources<BuiltinSourceOptions>
}
