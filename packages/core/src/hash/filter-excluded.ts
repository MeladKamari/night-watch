import { EXCLUDED_UPSTREAM_SOURCE } from '../registry.js'
import type { UnknownComponents } from '../types.js'
import { hashComponents } from './hash-components.js'

/**
 * Test/harness helper: removes the excluded upstream key (default `applePay`)
 * from a component map **before** hashing.
 *
 * Use this for filtered-hash parity. Never treat raw upstream `visitorId`
 * (42 sources) as equal to default-v1 hashes.
 */
export function omitExcludedUpstreamComponents(
  components: UnknownComponents,
  excludedKey: string = EXCLUDED_UPSTREAM_SOURCE,
): UnknownComponents {
  if (!(excludedKey in components)) {
    return { ...components }
  }
  const next: UnknownComponents = { ...components }
  delete next[excludedKey]
  return next
}

/**
 * Hashes components after omitting the excluded upstream source key.
 * Distinct from hashing an unmodified upstream 42-source map.
 */
export function hashComponentsOmittingExcluded(
  components: UnknownComponents,
  excludedKey: string = EXCLUDED_UPSTREAM_SOURCE,
): string {
  return hashComponents(omitExcludedUpstreamComponents(components, excludedKey))
}
