import {
  componentsToCanonicalString,
  hashComponents,
  x64hash128,
  type UnknownComponents,
} from '@thenightwatch/core'
import {
  NAMESPACED_ID_ALGORITHM,
  type IdentityDerivationMeta,
  type IdentityScope,
} from './types.js'

export class IdentityScopeError extends Error {
  override readonly name = 'IdentityScopeError'
}

/** Escape `|` and `\` so scope fields cannot break domain separation. */
export function escapeIdentityField(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

/**
 * Validates and normalizes an {@link IdentityScope}.
 * Rejects empty namespace; treats whitespace-only salt/domain as empty.
 */
export function normalizeIdentityScope(scope: IdentityScope): {
  namespace: string
  salt: string
  domain: string
  hasSalt: boolean
} {
  const namespace = scope.namespace.trim()
  if (!namespace) {
    throw new IdentityScopeError('IdentityScope.namespace must be a non-empty string')
  }
  const salt = (scope.salt ?? '').trim()
  const domain = (scope.domain ?? '').trim()
  return { namespace, salt, domain, hasSalt: salt.length > 0 }
}

/**
 * Builds the domain-separated string hashed for namespaced IDs.
 * Layout is versioned: algorithm|ns=…|dom=…|salt=…|cmp=…
 */
export function buildNamespacedHashInput(
  components: UnknownComponents,
  scope: IdentityScope,
): string {
  const { namespace, salt, domain } = normalizeIdentityScope(scope)
  const canonical = componentsToCanonicalString(components)
  return [
    NAMESPACED_ID_ALGORITHM,
    `ns=${escapeIdentityField(namespace)}`,
    `dom=${escapeIdentityField(domain)}`,
    `salt=${escapeIdentityField(salt)}`,
    `cmp=${canonical}`,
  ].join('|')
}

/**
 * Opt-in MurmurHash3 x64 128 over namespaced material.
 * Not equivalent to {@link hashComponents} / upstream visitorId.
 */
export function hashComponentsNamespaced(
  components: UnknownComponents,
  scope: IdentityScope,
): string {
  return x64hash128(buildNamespacedHashInput(components, scope))
}

export function describeIdentityDerivation(scope: IdentityScope): IdentityDerivationMeta {
  const { namespace, domain, hasSalt } = normalizeIdentityScope(scope)
  return {
    algorithm: NAMESPACED_ID_ALGORITHM,
    namespace,
    domain: domain.length > 0 ? domain : undefined,
    hasSalt,
    upstreamCompatible: false,
    notes: [
      'Namespaced visitorId is an optional first-party derivation — not FingerprintJS OSS compatible.',
      'Default load()/hashComponents() remain unsalted default-profile hashes.',
      'This SDK does not persist namespace/salt/domain or send them to third parties.',
      'Rotating salt or changing namespace/domain produces a new visitorId for the same components.',
    ],
  }
}

/** Convenience: baseline + namespaced ids for the same component map. */
export function deriveVisitorIds(
  components: UnknownComponents,
  scope: IdentityScope,
): {
  baselineVisitorId: string
  visitorId: string
  identity: IdentityDerivationMeta
} {
  return {
    baselineVisitorId: hashComponents(components),
    visitorId: hashComponentsNamespaced(components, scope),
    identity: describeIdentityDerivation(scope),
  }
}
