import { hashComponents } from '@thenightwatch/core'
import type { GetResult } from '../types.js'
import { describeIdentityDerivation, hashComponentsNamespaced } from './hash-namespaced.js'
import type { IdentityScope, NamespacedGetResult } from './types.js'

/**
 * Post-processes a default {@link GetResult} into a namespaced visitorId.
 * Does not mutate `result`; does not touch storage or network.
 */
export function applyIdentityScope(
  result: GetResult,
  scope: IdentityScope,
): NamespacedGetResult {
  const baselineVisitorId = hashComponents(result.components)
  const visitorId = hashComponentsNamespaced(result.components, scope)
  return {
    visitorId,
    baselineVisitorId,
    confidence: result.confidence,
    components: result.components,
    version: result.version,
    identity: describeIdentityDerivation(scope),
  }
}
