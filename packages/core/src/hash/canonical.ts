import { COMPONENT_ERROR_HASH_SENTINEL } from '../errors/hash-sentinel.js'
import type { UnknownComponents } from '../types.js'

/**
 * Builds the canonical component string used as MurmurHash3 input.
 *
 * Rules (FingerprintJS OSS v5.3.0 `componentsToCanonicalString`):
 * 1. Sort keys with `Object.keys(components).sort()`
 * 2. Escape `:`, `|`, and `\` in keys with a preceding `\`
 * 3. Error components → literal token {@link COMPONENT_ERROR_HASH_SENTINEL} (`error`)
 * 4. Otherwise `JSON.stringify(component.value)` (may be `undefined` for top-level undefined)
 * 5. Join `escapedKey:value` with `|`
 * 6. Never include `duration`
 */
export function componentsToCanonicalString(components: UnknownComponents): string {
  let result = ''
  for (const componentKey of Object.keys(components).sort()) {
    const component = components[componentKey]
    if (!component) {
      continue
    }
    const value =
      'error' in component ? COMPONENT_ERROR_HASH_SENTINEL : JSON.stringify(component.value)
    result += `${result ? '|' : ''}${componentKey.replace(/([:|\\])/g, '\\$1')}:${value}`
  }
  return result
}
