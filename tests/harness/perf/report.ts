import { ENABLED_SOURCES, SOURCE_MANIFEST_REVISION } from '@night-watch/core'
import { flagRelativeExpensive, summarizeDurations } from './stats.js'
import type {
  CollectTimingSample,
  DomCleanupSample,
  ModeCompareRow,
  PerfEntropyReport,
  SourceCostRow,
  StabilityRun,
  CollisionCohort,
  BundleSizeRow,
} from './types.js'

export const DEFAULT_RELATIVE_EXPENSIVE_FACTOR = 3

export type BuildPerfEntropyReportInput = {
  readonly consented: true
  readonly samples: readonly CollectTimingSample[]
  readonly environment: PerfEntropyReport['environment']
  readonly sdkVersion: string
  readonly stability: readonly StabilityRun[]
  readonly modeComparisons: readonly ModeCompareRow[]
  readonly collisions: readonly CollisionCohort[]
  readonly bundleSizes: readonly BundleSizeRow[]
  readonly domCleanup?: DomCleanupSample
  readonly operationalNotes?: readonly string[]
  readonly notRun?: readonly string[]
  readonly relativeExpensiveFactor?: number
  readonly generatedAt?: Date
  readonly enabledSources?: readonly string[]
}

/**
 * Aggregates consented timing samples into a report.
 * Throws if consent is not literally `true` or samples are empty.
 */
export function buildPerfEntropyReport(
  input: BuildPerfEntropyReportInput,
): PerfEntropyReport {
  if (input.consented !== true) {
    throw new Error('Perf/entropy report requires consented: true')
  }
  if (input.samples.length === 0) {
    throw new Error('Perf/entropy report requires at least one timing sample')
  }

  const factor = input.relativeExpensiveFactor ?? DEFAULT_RELATIVE_EXPENSIVE_FACTOR
  const enabledSources = input.enabledSources ?? ENABLED_SOURCES
  const wallClock = summarizeDurations(input.samples.map((s) => s.wallMs))

  const durationLists = new Map<string, number[]>()
  for (const key of enabledSources) {
    durationLists.set(key, [])
  }
  for (const sample of input.samples) {
    for (const [key, ms] of Object.entries(sample.sourceDurationsMs)) {
      const list = durationLists.get(key)
      if (list) {
        list.push(ms)
      } else {
        durationLists.set(key, [ms])
      }
    }
  }

  const meansByKey: Record<string, number> = {}
  const statsByKey = new Map<string, ReturnType<typeof summarizeDurations>>()
  for (const [key, list] of durationLists) {
    const stats = summarizeDurations(list)
    statsByKey.set(key, stats)
    meansByKey[key] = stats.mean
  }
  const expensive = flagRelativeExpensive(meansByKey, factor)
  const sourceCosts: SourceCostRow[] = [...statsByKey.entries()]
    .map(([key, stats]) => ({
      key,
      stats,
      expensiveRelative: expensive.has(key),
    }))
    .sort((a, b) => b.stats.mean - a.stats.mean)

  return {
    generatedAtIso: (input.generatedAt ?? new Date()).toISOString(),
    consented: true,
    environment: input.environment,
    algorithm: {
      sourceManifestRevision: SOURCE_MANIFEST_REVISION,
      enabledSourceCount: enabledSources.length,
      sdkVersion: input.sdkVersion,
    },
    wallClock,
    sourceCosts,
    relativeExpensiveFactor: factor,
    stability: [...input.stability],
    modeComparisons: [...input.modeComparisons],
    collisions: [...input.collisions],
    bundleSizes: [...input.bundleSizes],
    domCleanup: input.domCleanup,
    operationalNotes: [...(input.operationalNotes ?? [])],
    notRun: [...(input.notRun ?? [])],
  }
}

/** Human-readable markdown for `reference/perf-entropy-report.md`. */
export function formatPerfEntropyMarkdown(report: PerfEntropyReport): string {
  const lines: string[] = []
  lines.push('# Performance, stability & entropy evaluation')
  lines.push('')
  lines.push(`Generated: \`${report.generatedAtIso}\``)
  lines.push(`Consented local sample: **yes**`)
  lines.push('')
  lines.push('## Environment')
  lines.push('')
  lines.push(`| Field | Value |`)
  lines.push(`|---|---|`)
  lines.push(`| Browser | ${report.environment.browserName} |`)
  lines.push(`| Device class | ${report.environment.deviceClass} |`)
  lines.push(`| Headless | ${String(report.environment.headless)} |`)
  lines.push(`| Locale | ${report.environment.locale} |`)
  lines.push(`| Timezone | ${report.environment.timezoneId ?? '(unset)'} |`)
  if (report.environment.viewport) {
    lines.push(
      `| Viewport | ${report.environment.viewport.width}×${report.environment.viewport.height} |`,
    )
  }
  lines.push(`| UA | \`${report.environment.userAgent.replace(/\|/g, '/')}\` |`)
  lines.push('')
  lines.push('## Algorithm')
  lines.push('')
  lines.push(
    `- Manifest: \`${report.algorithm.sourceManifestRevision}\` (${report.algorithm.enabledSourceCount} sources)`,
  )
  lines.push(`- SDK version field: \`${report.algorithm.sdkVersion}\``)
  lines.push('')
  lines.push('## Wall-clock collection (`load` delayFallback=0 + `get`)')
  lines.push('')
  lines.push(
    `n=${report.wallClock.sampleSize} · min=${fmt(report.wallClock.min)} · p50=${fmt(report.wallClock.p50)} · p95=${fmt(report.wallClock.p95)} · p99=${fmt(report.wallClock.p99)} · max=${fmt(report.wallClock.max)} · mean=${fmt(report.wallClock.mean)} (ms)`,
  )
  lines.push('')
  lines.push(
    `Relative expensive flag: mean > ${report.relativeExpensiveFactor}× max(1ms noise floor, median of source means) (profiling hint only — not an SLA).`,
  )
  lines.push('')
  lines.push('## Per-source cost (top by mean)')
  lines.push('')
  lines.push('| Source | n | mean | p50 | p95 | p99 | expensive? |')
  lines.push('|---|---:|---:|---:|---:|---:|:---:|')
  for (const row of report.sourceCosts.slice(0, 15)) {
    lines.push(
      `| \`${row.key}\` | ${row.stats.sampleSize} | ${fmt(row.stats.mean)} | ${fmt(row.stats.p50)} | ${fmt(row.stats.p95)} | ${fmt(row.stats.p99)} | ${row.expensiveRelative ? 'yes' : ''} |`,
    )
  }
  if (report.sourceCosts.length > 15) {
    lines.push(`| … | ${report.sourceCosts.length - 15} more | | | | | |`)
  }
  lines.push('')
  lines.push('## Stability')
  lines.push('')
  for (const run of report.stability) {
    lines.push(
      `- **${run.label}**: unique=${run.uniqueCount}/${run.visitorIds.length}; majority share=${(run.majorityShare * 100).toFixed(1)}%` +
        (run.majorityVisitorId ? ` (\`${run.majorityVisitorId}\`)` : ''),
    )
    for (const note of run.notes) {
      lines.push(`  - ${note}`)
    }
  }
  lines.push('')
  lines.push('## Mode comparisons')
  lines.push('')
  if (report.modeComparisons.length === 0) {
    lines.push('_None recorded._')
  } else {
    for (const row of report.modeComparisons) {
      lines.push(
        `- ${row.modeA} vs ${row.modeB}: visitorId equal=${row.visitorIdEqual}`,
      )
      for (const note of row.notes) {
        lines.push(`  - ${note}`)
      }
    }
  }
  lines.push('')
  lines.push('## Collision / uniqueness (consented cohorts)')
  lines.push('')
  lines.push(
    'Ratios are **local sample statistics only** — not calibrated worldwide uniqueness or FPR.',
  )
  lines.push('')
  for (const cohort of report.collisions) {
    lines.push(
      `- **${cohort.label}**: unique=${cohort.uniqueVisitorIds}/${cohort.sampleSize} (ratio=${cohort.uniquenessRatio.toFixed(3)}); approx collision pairs=${cohort.collisionPairsApprox}`,
    )
    for (const note of cohort.notes) {
      lines.push(`  - ${note}`)
    }
  }
  lines.push('')
  lines.push('## Bundle sizes (published artifacts)')
  lines.push('')
  lines.push('| Artifact | uncompressed | gzip |')
  lines.push('|---|---:|---:|')
  for (const row of report.bundleSizes) {
    lines.push(
      `| \`${row.path}\` | ${row.bytesUncompressed} | ${row.bytesGzip} |`,
    )
  }
  lines.push('')
  if (report.domCleanup) {
    lines.push('## DOM cleanup snapshot')
    lines.push('')
    lines.push(
      `nodes before=${report.domCleanup.nodesBefore}, after=${report.domCleanup.nodesAfter}, delta=${report.domCleanup.delta}`,
    )
    for (const note of report.domCleanup.notes) {
      lines.push(`- ${note}`)
    }
    lines.push('')
  }
  lines.push('## Operational notes')
  lines.push('')
  for (const note of report.operationalNotes) {
    lines.push(`- ${note}`)
  }
  lines.push('')
  lines.push('## NOT RUN')
  lines.push('')
  if (report.notRun.length === 0) {
    lines.push('_None listed._')
  } else {
    for (const item of report.notRun) {
      lines.push(`- ${item}`)
    }
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) {
    return String(n)
  }
  return n < 10 ? n.toFixed(2) : n.toFixed(1)
}
