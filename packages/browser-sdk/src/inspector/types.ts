import type { ReliabilityTier } from '../profiles/types.js'

/** Versioned change-inspector catalog (independent of `SOURCE_MANIFEST_REVISION`). */
export const CHANGE_INSPECTOR_REVISION = 'night-watch-change-inspector-v1' as const

export type ChangeInspectorRevision = typeof CHANGE_INSPECTOR_REVISION

/** How a single source differs between two local collections. */
export type SourceChangeKind =
  | 'unchanged'
  | 'value_changed'
  | 'error_changed'
  | 'value_to_error'
  | 'error_to_value'
  | 'added'
  | 'removed'
  | 'duration_only'

export type ComponentArm = 'value' | 'error' | 'missing'

export type SourceChangeRow = {
  readonly source: string
  readonly kind: SourceChangeKind
  readonly beforeArm: ComponentArm
  readonly afterArm: ComponentArm
  /** Privacy-safe preview of before value/error (never raw secrets / page URLs). */
  readonly beforePreview: string | null
  readonly afterPreview: string | null
  readonly beforeDurationMs: number | null
  readonly afterDurationMs: number | null
  readonly durationDeltaMs: number | null
  /**
   * Heuristic instability tier when the source is in the default-profile set.
   * Custom / unknown keys use `unknown`.
   */
  readonly expectedInstability: ReliabilityTier | 'unknown'
  /**
   * Probabilistic hint only — not a calibrated probability or identity claim.
   * Example: "volatile source often churns across sessions".
   */
  readonly hint: string
}

export type FingerprintChangeReport = {
  readonly revision: ChangeInspectorRevision
  readonly beforeVisitorId: string | null
  readonly afterVisitorId: string | null
  readonly visitorIdChanged: boolean
  readonly comparedSourceCount: number
  readonly changedSourceCount: number
  /** Stable lexicographic order by source name. */
  readonly rows: readonly SourceChangeRow[]
  /** Subset of rows where kind !== unchanged (stable sort). */
  readonly changes: readonly SourceChangeRow[]
  readonly notes: readonly string[]
  /**
   * Fixed disclaimer — comparisons are probabilistic hints, not device-identity proof.
   */
  readonly disclaimer: string
}

export type InspectFingerprintChangeOptions = {
  /**
   * When true (default), rows with `kind: 'unchanged'` are omitted from `changes`
   * but still counted in `comparedSourceCount`. Full `rows` always includes all.
   */
  readonly includeUnchangedInRows?: boolean
  /** Include duration-only deltas as changes when absolute delta ≥ this (default 5). */
  readonly durationDeltaThresholdMs?: number
  /** Max preview string length (default 120). */
  readonly previewMaxLength?: number
}

export const CHANGE_INSPECTOR_DISCLAIMER =
  'Probabilistic hint only: component diffs do not prove the same or different person/device, and must not be used as an identity guarantee.' as const
