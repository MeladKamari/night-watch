import type { SourceCategory } from './categories.js'

/**
 * Consent / permission signal for optional policy-gated collection.
 * Integrators supply this from their own notice UX — the SDK does not store it.
 */
export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'not_required'

export type ConsentSignal = {
  readonly status: ConsentStatus
  /**
   * Free-text purpose for the integrator's disclosure record.
   * Never used to infer region, nationality, or lawful basis automatically.
   */
  readonly purpose?: string
  /** Optional ISO-8601 timestamp when consent was granted. */
  readonly grantedAtIso?: string
  /** Optional opaque policy/notice version string owned by the app. */
  readonly noticeVersion?: string
}

/**
 * Opt-in collection policy. Default `load()` ignores this entirely.
 * Omitting categories/sources changes the resulting visitorId vs full default-profile.
 */
export type CollectionPolicy = {
  readonly consent: ConsentSignal
  /** Categories whose collectors must never run. */
  readonly omitCategories?: readonly SourceCategory[]
  /** Additional builtin source keys to skip (merged with category omissions). */
  readonly omitSources?: readonly string[]
  /**
   * When set, only these categories may run (minus omitCategories/omitSources).
   * Empty array means collect nothing (still requires consent).
   */
  readonly allowCategories?: readonly SourceCategory[]
}

export type PolicyResolution = {
  readonly consentStatus: ConsentStatus
  readonly excludedSources: readonly string[]
  readonly omittedCategories: readonly SourceCategory[]
  readonly includedSourceCount: number
  /** True when exclusions are non-empty vs full 41-source default. */
  readonly visitorIdWillDifferFromFullDefault: boolean
  readonly purpose: string | undefined
  readonly noticeVersion: string | undefined
  readonly notes: readonly string[]
}
