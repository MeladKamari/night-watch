import type { EnabledSourceName } from '@night-watch/core'

/** Heuristic stability tier for an Default-profile entropy source (not a uniqueness claim). */
export type ReliabilityTier = 'stable' | 'moderate' | 'volatile'

/**
 * Opt-in reliability profiles.
 * - `conservative` — stable tier only (fewer / more stable selectors)
 * - `balanced` — stable + moderate
 * - `diagnostic` — all 41 sources (same inclusion as default load; for labeled diagnostics)
 */
export type ReliabilityProfileId = 'conservative' | 'balanced' | 'diagnostic'

/** Versioned profile catalog revision (independent of `SOURCE_MANIFEST_REVISION`). */
export const RELIABILITY_PROFILES_REVISION = 'night-watch-reliability-profiles-v1' as const

export type ReliabilityProfilesRevision = typeof RELIABILITY_PROFILES_REVISION

export type SourceReliabilityRow = {
  readonly source: EnabledSourceName
  readonly tier: ReliabilityTier
}

export type ReliabilityProfileManifest = {
  readonly revision: ReliabilityProfilesRevision
  readonly profileId: ReliabilityProfileId
  readonly includedSources: readonly EnabledSourceName[]
  readonly excludedSources: readonly EnabledSourceName[]
  readonly includedCount: number
  readonly excludedCount: number
  readonly notes: readonly string[]
}

export type ReliabilityProfileResolution = {
  readonly manifest: ReliabilityProfileManifest
  /** True when exclusions are non-empty vs full default-profile (41). */
  readonly visitorIdWillDifferFromFullDefault: boolean
}
