/** Percentile / summary stats over a numeric sample (milliseconds or counts). */
export type DurationStats = {
  readonly sampleSize: number
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
}

/** One timed collection sample (wall clock + optional per-source durations). */
export type CollectTimingSample = {
  readonly wallMs: number
  readonly visitorId: string
  readonly sourceDurationsMs: Readonly<Record<string, number>>
  readonly errorKeys: readonly string[]
}

export type SourceCostRow = {
  readonly key: string
  readonly stats: DurationStats
  /** Flagged when mean exceeds the cohort median × factor (observed, not invented absolute). */
  readonly expensiveRelative: boolean
}

export type StabilityRun = {
  readonly label: string
  readonly visitorIds: readonly string[]
  /** Distinct visitorIds / sample size (1 = perfectly stable in this cohort). */
  readonly uniqueCount: number
  readonly majorityVisitorId: string | undefined
  readonly majorityShare: number
  readonly notes: readonly string[]
}

export type ModeCompareRow = {
  readonly modeA: string
  readonly modeB: string
  readonly visitorIdEqual: boolean
  readonly visitorIdA: string
  readonly visitorIdB: string
  readonly notes: readonly string[]
}

export type CollisionCohort = {
  readonly label: string
  readonly sampleSize: number
  readonly uniqueVisitorIds: number
  /**
   * Collisions among samples that share an id with at least one other sample.
   * Reported as numerator/denominator — never a calibrated worldwide rate.
   */
  readonly collisionPairsApprox: number
  readonly uniquenessRatio: number
  readonly notes: readonly string[]
}

export type BundleSizeRow = {
  readonly path: string
  readonly bytesUncompressed: number
  readonly bytesGzip: number
}

export type DomCleanupSample = {
  readonly nodesBefore: number
  readonly nodesAfter: number
  readonly delta: number
  readonly notes: readonly string[]
}

export type PerfEntropyReport = {
  readonly generatedAtIso: string
  readonly consented: true
  readonly environment: {
    readonly userAgent: string
    readonly browserName: string
    readonly headless: boolean | 'unknown'
    readonly locale: string
    readonly timezoneId: string | undefined
    readonly viewport: { readonly width: number; readonly height: number } | undefined
    readonly deviceClass: string
  }
  readonly algorithm: {
    readonly sourceManifestRevision: string
    readonly enabledSourceCount: number
    readonly sdkVersion: string
  }
  readonly wallClock: DurationStats
  readonly sourceCosts: readonly SourceCostRow[]
  readonly relativeExpensiveFactor: number
  readonly stability: readonly StabilityRun[]
  readonly modeComparisons: readonly ModeCompareRow[]
  readonly collisions: readonly CollisionCohort[]
  readonly bundleSizes: readonly BundleSizeRow[]
  readonly domCleanup: DomCleanupSample | undefined
  readonly operationalNotes: readonly string[]
  readonly notRun: readonly string[]
}
