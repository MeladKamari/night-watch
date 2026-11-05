import type { BuiltinComponents, Confidence } from '@night-watch/core'

/**
 * First-party identity scope for optional namespaced visitor IDs.
 * Opt-in only — default {@link import('../agent.js').load} / {@link import('@night-watch/core').hashComponents}
 * remain upstream-shaped (unsalted).
 *
 * The SDK never persists this scope to storage and never exfiltrates it.
 */
export type IdentityScope = {
  /**
   * Required first-party namespace (product / tenant / app id).
   * Different namespaces must not collide for the same browser entropy.
   */
  readonly namespace: string
  /**
   * Optional secret salt held by the first party.
   * Never written to localStorage/cookies by this SDK; never included in debug exports.
   */
  readonly salt?: string
  /**
   * Optional domain-separation label (e.g. site or environment name).
   * App-supplied — not auto-read from `location` (avoids surprise cross-context binding).
   */
  readonly domain?: string
}

/** Algorithm id for namespaced derivation (not `default-v1` component hashing alone). */
export const NAMESPACED_ID_ALGORITHM = 'night-watch-namespaced-v1' as const

export type NamespacedIdAlgorithm = typeof NAMESPACED_ID_ALGORITHM

export type IdentityDerivationMeta = {
  readonly algorithm: NamespacedIdAlgorithm
  readonly namespace: string
  readonly domain: string | undefined
  /** Whether a non-empty salt was supplied (value itself is never returned). */
  readonly hasSalt: boolean
  /**
   * Always false: namespaced IDs are not FingerprintJS OSS / raw `@night-watch` default visitorIds.
   */
  readonly upstreamCompatible: false
  readonly notes: readonly string[]
}

export type NamespacedGetResult = {
  readonly visitorId: string
  readonly confidence: Confidence
  readonly components: BuiltinComponents
  readonly version: string
  /** Default unsalted hash of the same components (for migration / comparison only). */
  readonly baselineVisitorId: string
  readonly identity: IdentityDerivationMeta
}
