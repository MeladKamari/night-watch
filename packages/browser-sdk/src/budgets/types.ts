/** Versioned resource-budget catalog (independent of `SOURCE_MANIFEST_REVISION`). */
export const RESOURCE_BUDGETS_REVISION = 'night-watch-resource-budgets-v1' as const

export type ResourceBudgetsRevision = typeof RESOURCE_BUDGETS_REVISION

/**
 * Opt-in collection budget.
 * Default {@link import('../agent.js').load} ignores budgets entirely.
 */
export type CollectionBudget = {
  /** Abort mid-collection; aborted sources become error components (never fake success). */
  readonly signal?: AbortSignal
  /** Wall-clock cap for the whole collection once collectors start. */
  readonly totalTimeoutMs?: number
  /** Cap for each source load/get stage (each stage raced independently). */
  readonly perSourceTimeoutMs?: number
  /**
   * `idle` yields cooperatively between starting sources (nonblocking scheduling).
   * `sync` (default) matches default loadSources pacing aside from abort/timeouts.
   */
  readonly scheduling?: 'sync' | 'idle'
  /** Idle yield fallback when `scheduling: 'idle'` (default 16). */
  readonly idleYieldMs?: number
}

export type ResolvedCollectionBudget = {
  readonly signal?: AbortSignal
  readonly totalTimeoutMs?: number
  readonly perSourceTimeoutMs?: number
  readonly scheduling: 'sync' | 'idle'
  readonly idleYieldMs: number
}

export type ResourceBudgetManifest = {
  readonly revision: ResourceBudgetsRevision
  readonly totalTimeoutMs: number | null
  readonly perSourceTimeoutMs: number | null
  readonly scheduling: 'sync' | 'idle'
  readonly idleYieldMs: number
  readonly hasExternalSignal: boolean
  readonly notes: readonly string[]
}

export type ResourceBudgetResolution = {
  readonly manifest: ResourceBudgetManifest
  /**
   * True when any timeout/abort may produce error components, which changes
   * visitorId vs a fully successful default run. Successful full runs with a
   * budget configured but never hit still match default IDs for the same sources.
   */
  readonly mayAlterVisitorIdOnTimeoutOrAbort: boolean
}
