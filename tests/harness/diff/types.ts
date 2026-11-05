/** Classification of a single-source comparison against filtered upstream. */
export type SourceDiffKind =
  | 'match'
  | 'value_mismatch'
  | 'error_mismatch'
  | 'kind_mismatch'
  | 'missing_local'
  | 'missing_upstream'

export type ComponentSnapshot = {
  readonly kind: 'value' | 'error'
  /** Stable summary for display/diff (duration excluded). */
  readonly summary: string
  /** Hash-relevant payload: value JSON or error sentinel token. */
  readonly hashToken: string
}

export type SourceDiffRow = {
  readonly key: string
  readonly kind: SourceDiffKind
  readonly local: ComponentSnapshot | undefined
  readonly upstream: ComponentSnapshot | undefined
}

export type UpstreamDiffReport = {
  readonly generatedAtIso: string
  readonly consented: true
  readonly upstreamPin: {
    readonly packageName: string
    readonly packageVersion: string
    readonly commit: string
  }
  readonly localManifest: {
    readonly revision: string
    readonly enabledSourceCount: number
    readonly excludedKey: string
  }
  readonly localVisitorId: string
  readonly upstreamRawVisitorId: string
  /** Always expected to differ when upstream still includes applePay in its hash input. */
  readonly rawVisitorIdEqual: boolean
  readonly localHash: string
  readonly upstreamFilteredHash: string
  readonly filteredHashEqual: boolean
  readonly sourceRows: readonly SourceDiffRow[]
  readonly matchCount: number
  readonly mismatchCount: number
  readonly sourceParityLabel: string
  readonly notes: readonly string[]
}
