import type { UnknownComponents } from '../types.js'
import { componentsToCanonicalString } from './canonical.js'
import { x64hash128 } from './murmur3.js'

/**
 * Hashes a component map to a 32-char hex visitor id fragment.
 * Equivalent to FingerprintJS OSS v5.3.0 `hashComponents`.
 */
export function hashComponents(components: UnknownComponents): string {
  return x64hash128(componentsToCanonicalString(components))
}
