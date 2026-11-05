import { load, type LoadAgentOptions } from '../agent.js'
import type { GetResult } from '../types.js'
import {
  inspectFingerprintChange,
  type FingerprintCollectionInput,
} from './compare.js'
import { formatFingerprintChangeReport } from './format.js'
import type { FingerprintChangeReport, InspectFingerprintChangeOptions } from './types.js'

export type InspectFingerprintRebuildOptions = LoadAgentOptions & {
  readonly inspect?: InspectFingerprintChangeOptions
  /** Format style for the returned `formatted` string (default markdown). */
  readonly formatStyle?: 'markdown' | 'text'
}

export type InspectFingerprintRebuildResult = {
  readonly first: GetResult
  readonly second: GetResult
  readonly report: FingerprintChangeReport
  readonly formatted: string
}

/**
 * Opt-in helper: one `load()`, two consecutive `get()` calls, then a local diff.
 * Default {@link load} behavior is unchanged when this helper is unused.
 * Labels remain probabilistic hints — not identity guarantees.
 */
export async function inspectFingerprintRebuild(
  options: InspectFingerprintRebuildOptions = {},
): Promise<InspectFingerprintRebuildResult> {
  const { inspect: inspectOptions, formatStyle, ...loadOptions } = options
  const agent = await load(loadOptions)
  const first = await agent.get()
  const second = await agent.get()
  const report = inspectFingerprintChange(first, second, inspectOptions)
  const formatted = formatFingerprintChangeReport(report, {
    style: formatStyle === 'text' ? 'text' : 'markdown',
  })
  return { first, second, report, formatted }
}

/** Convenience when you already hold two component maps / GetResults. */
export function inspectFingerprintChangeAndFormat(
  before: GetResult | FingerprintCollectionInput,
  after: GetResult | FingerprintCollectionInput,
  options: InspectFingerprintChangeOptions & { formatStyle?: 'markdown' | 'text' } = {},
): { report: FingerprintChangeReport; formatted: string } {
  const { formatStyle, ...inspectOptions } = options
  const report = inspectFingerprintChange(before, after, inspectOptions)
  return {
    report,
    formatted: formatFingerprintChangeReport(report, {
      style: formatStyle === 'text' ? 'text' : 'markdown',
    }),
  }
}
