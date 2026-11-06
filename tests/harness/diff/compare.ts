import {
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  SOURCE_MANIFEST_REVISION,
  UPSTREAM_PIN,
  componentsToCanonicalString,
  hashComponents,
  hashComponentsOmittingExcluded,
  omitExcludedUpstreamComponents,
  type UnknownComponents,
} from '@thenightwatch/core'
import { snapshotComponents } from './snapshot.js'
import type { ComponentSnapshot, SourceDiffKind, SourceDiffRow, UpstreamDiffReport } from './types.js'

export type BuildDiffReportInput = {
  localComponents: UnknownComponents
  upstreamComponents: UnknownComponents
  localVisitorId: string
  upstreamRawVisitorId: string
  /** Must be true — harness refuses non-consented samples. */
  consented: boolean
  generatedAt?: Date
  notes?: readonly string[]
}

/**
 * Compares default-profile local components to upstream components with `applePay` omitted
 * for filtered-hash parity. Never treats raw upstream visitorId equality as success.
 */
export function buildUpstreamDiffReport(input: BuildDiffReportInput): UpstreamDiffReport {
  if (input.consented !== true) {
    throw new Error('Upstream differential harness requires consented: true')
  }

  const localSnaps = snapshotComponents(input.localComponents)
  const upstreamFiltered = omitExcludedUpstreamComponents(input.upstreamComponents)
  const upstreamSnaps = snapshotComponents(upstreamFiltered)

  const rows: SourceDiffRow[] = []
  for (const key of ENABLED_SOURCES) {
    rows.push(diffSource(key, localSnaps[key], upstreamSnaps[key]))
  }

  const matchCount = rows.filter((row) => row.kind === 'match').length
  const mismatchCount = rows.length - matchCount

  const localHash = hashComponents(input.localComponents)
  const upstreamFilteredHash = hashComponentsOmittingExcluded(input.upstreamComponents)
  const filteredHashEqual = localHash === upstreamFilteredHash
  const rawVisitorIdEqual = input.localVisitorId === input.upstreamRawVisitorId

  const notes = [
    ...(input.notes ?? []),
    'Raw upstream visitorId equality is NOT a release gate (D-002 / D-061).',
    `Excluded upstream key in harness only: ${EXCLUDED_UPSTREAM_SOURCE}`,
    `Local canonical length: ${componentsToCanonicalString(input.localComponents).length}`,
    `Filtered upstream canonical length: ${componentsToCanonicalString(upstreamFiltered).length}`,
  ]

  return {
    generatedAtIso: (input.generatedAt ?? new Date()).toISOString(),
    consented: true,
    upstreamPin: {
      packageName: UPSTREAM_PIN.packageName,
      packageVersion: UPSTREAM_PIN.packageVersion,
      commit: UPSTREAM_PIN.commit,
    },
    localManifest: {
      revision: SOURCE_MANIFEST_REVISION,
      enabledSourceCount: ENABLED_SOURCES.length,
      excludedKey: EXCLUDED_UPSTREAM_SOURCE,
    },
    localVisitorId: input.localVisitorId,
    upstreamRawVisitorId: input.upstreamRawVisitorId,
    rawVisitorIdEqual,
    localHash,
    upstreamFilteredHash,
    filteredHashEqual,
    sourceRows: rows,
    matchCount,
    mismatchCount,
    sourceParityLabel: `${matchCount}/${ENABLED_SOURCES.length}`,
    notes,
  }
}

export function diffSource(
  key: string,
  local: ComponentSnapshot | undefined,
  upstream: ComponentSnapshot | undefined,
): SourceDiffRow {
  if (!local && !upstream) {
    return { key, kind: 'missing_local', local, upstream }
  }
  if (!local) {
    return { key, kind: 'missing_local', local, upstream }
  }
  if (!upstream) {
    return { key, kind: 'missing_upstream', local, upstream }
  }
  if (local.kind !== upstream.kind) {
    return { key, kind: 'kind_mismatch', local, upstream }
  }
  if (local.hashToken === upstream.hashToken) {
    return { key, kind: 'match', local, upstream }
  }
  const kind: SourceDiffKind = local.kind === 'value' ? 'value_mismatch' : 'error_mismatch'
  return { key, kind, local, upstream }
}

/** Markdown summary for docs / CI artifacts (no PII). */
export function formatDiffReportMarkdown(report: UpstreamDiffReport): string {
  const lines: string[] = [
    `# Upstream differential report`,
    ``,
    `- Generated: ${report.generatedAtIso}`,
    `- Consented local sample: yes`,
    `- Upstream: ${report.upstreamPin.packageName}@${report.upstreamPin.packageVersion} (\`${report.upstreamPin.commit.slice(0, 12)}…\`)`,
    `- Local manifest: ${report.localManifest.revision} (${report.localManifest.enabledSourceCount} sources; exclude \`${report.localManifest.excludedKey}\`)`,
    `- Source parity: **${report.sourceParityLabel}** (mismatches: ${report.mismatchCount})`,
    `- Filtered hash equal: **${report.filteredHashEqual ? 'yes' : 'no'}**`,
    `- Raw visitorId equal: **${report.rawVisitorIdEqual ? 'yes' : 'no'}** (not a gate)`,
    `- Local visitorId: \`${report.localVisitorId}\``,
    `- Upstream raw visitorId: \`${report.upstreamRawVisitorId}\``,
    `- Local hash: \`${report.localHash}\``,
    `- Upstream filtered hash: \`${report.upstreamFilteredHash}\``,
    ``,
    `## Per-source`,
    ``,
    `| Source | Result |`,
    `|---|---|`,
  ]
  for (const row of report.sourceRows) {
    lines.push(`| \`${row.key}\` | ${row.kind} |`)
  }
  lines.push(``, `## Notes`, ``)
  for (const note of report.notes) {
    lines.push(`- ${note}`)
  }
  lines.push(``)
  return lines.join('\n')
}
