import type { FingerprintChangeReport, SourceChangeRow } from './types.js'

export type FormatFingerprintChangeOptions = {
  /** `markdown` (default) or plain `text`. */
  readonly style?: 'markdown' | 'text'
  /** Max change rows to render (default 50). */
  readonly maxChanges?: number
}

/**
 * Renders a privacy-safe visual diff for consoles / local UI copy-paste.
 * Does not perform network I/O.
 */
export function formatFingerprintChangeReport(
  report: FingerprintChangeReport,
  options: FormatFingerprintChangeOptions = {},
): string {
  const style = options.style === 'text' ? 'text' : 'markdown'
  const maxChanges = options.maxChanges === undefined ? 50 : options.maxChanges
  const changes = report.changes.slice(0, maxChanges)

  if (style === 'text') {
    return formatText(report, changes, maxChanges)
  }
  return formatMarkdown(report, changes, maxChanges)
}

function formatMarkdown(
  report: FingerprintChangeReport,
  changes: readonly SourceChangeRow[],
  maxChanges: number,
): string {
  const lines: string[] = [
    `## Fingerprint change inspector (\`${report.revision}\`)`,
    '',
    `> ${report.disclaimer}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Before visitorId | \`${report.beforeVisitorId ?? '(none)'}\` |`,
    `| After visitorId | \`${report.afterVisitorId ?? '(none)'}\` |`,
    `| visitorId changed | ${report.visitorIdChanged ? 'yes' : 'no'} |`,
    `| Compared sources | ${report.comparedSourceCount} |`,
    `| Changed sources | ${report.changedSourceCount} |`,
    '',
    '### Changes (stable source order)',
    '',
  ]

  if (changes.length === 0) {
    lines.push('_No component changes detected in this pair._', '')
  } else {
    lines.push(
      '| Source | Kind | Instability | Δms | Before | After | Hint |',
      '|---|---|---|---:|---|---|---|',
    )
    for (const row of changes) {
      lines.push(
        `| \`${row.source}\` | ${row.kind} | ${row.expectedInstability} | ${formatDelta(row.durationDeltaMs)} | ${cell(row.beforePreview)} | ${cell(row.afterPreview)} | ${escapeCell(row.hint)} |`,
      )
    }
    if (report.changedSourceCount > maxChanges) {
      lines.push('', `_… ${report.changedSourceCount - maxChanges} more change(s) omitted._`)
    }
    lines.push('')
  }

  lines.push('### Notes', '')
  for (const note of report.notes) {
    lines.push(`- ${note}`)
  }
  lines.push('')
  return lines.join('\n')
}

function formatText(
  report: FingerprintChangeReport,
  changes: readonly SourceChangeRow[],
  maxChanges: number,
): string {
  const lines: string[] = [
    `Fingerprint change inspector (${report.revision})`,
    report.disclaimer,
    `before=${report.beforeVisitorId ?? '(none)'} after=${report.afterVisitorId ?? '(none)'} changed=${report.visitorIdChanged}`,
    `compared=${report.comparedSourceCount} changes=${report.changedSourceCount}`,
    '',
  ]
  for (const row of changes) {
    lines.push(
      `[${row.kind}] ${row.source} (${row.expectedInstability}) Δms=${formatDelta(row.durationDeltaMs)}`,
      `  before: ${row.beforePreview ?? '∅'}`,
      `  after:  ${row.afterPreview ?? '∅'}`,
      `  hint:   ${row.hint}`,
      '',
    )
  }
  if (report.changedSourceCount > maxChanges) {
    lines.push(`… ${report.changedSourceCount - maxChanges} more change(s) omitted.`, '')
  }
  for (const note of report.notes) {
    lines.push(`- ${note}`)
  }
  lines.push('')
  return lines.join('\n')
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta}`
  return String(delta)
}

function cell(preview: string | null): string {
  if (preview === null) return '∅'
  return `\`${escapeCell(preview)}\``
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** Canonical JSON for report fixtures / local export. */
export function fingerprintChangeReportToJson(report: FingerprintChangeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
