/** Versioned entropy-experiment catalog (independent of `SOURCE_MANIFEST_REVISION`). */
export const ENTROPY_EXPERIMENTS_REVISION = 'night-watch-entropy-experiments-v1' as const

export type EntropyExperimentsRevision = typeof ENTROPY_EXPERIMENTS_REVISION

export type ExperimentConsentStatus = 'granted' | 'denied' | 'withdrawn'

export type ExperimentConsent = {
  readonly status: ExperimentConsentStatus
  /** Integrator disclosure metadata only — not sent anywhere by the SDK. */
  readonly purpose?: string
  readonly noticeVersion?: string
}

export type ExperimentSample = {
  readonly visitorId: string
  /** Optional opaque cohort label (e.g. browser family) — not a person identifier. */
  readonly cohort?: string
  /** Wall-clock ms for the sample's get() (optional). */
  readonly durationMs?: number
  readonly collectedAt?: string
}

export type WithinBrowserVarianceStats = {
  readonly cohort: string
  readonly sampleSize: number
  readonly uniqueVisitorIds: number
  /** Share of samples matching the majority visitorId (0–1). */
  readonly majorityShare: number
  readonly majorityVisitorId: string | null
  readonly notes: readonly string[]
}

export type AcrossBrowserCollisionStats = {
  readonly label: string
  readonly sampleSize: number
  readonly uniqueVisitorIds: number
  readonly collisionPairsApprox: number
  readonly uniquenessRatio: number
  readonly notes: readonly string[]
}

export type ExperimentAggregateReport = {
  readonly revision: EntropyExperimentsRevision
  readonly consented: true
  readonly purpose: string | null
  readonly noticeVersion: string | null
  readonly sampleCount: number
  readonly cohorts: readonly string[]
  readonly withinBrowser: readonly WithinBrowserVarianceStats[]
  readonly acrossBrowser: AcrossBrowserCollisionStats
  readonly notes: readonly string[]
  readonly disclaimer: string
}

export const ENTROPY_EXPERIMENT_DISCLAIMER =
  'Lab aggregate only: statistics are not worldwide uniqueness, FPR, or device-identity guarantees. Samples stay local unless the integrator explicitly exports them.' as const
