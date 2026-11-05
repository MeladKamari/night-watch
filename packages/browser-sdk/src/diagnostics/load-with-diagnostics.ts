import { load, type LoadAgentOptions } from '../agent.js'
import type { Agent, GetResult } from '../types.js'
import { exportDiagnosticSnapshot } from './export-snapshot.js'
import type {
  DiagnosticExportOptions,
  DiagnosticExportResult,
} from './types.js'
import { DIAGNOSTICS_REVISION } from './types.js'

export type LoadWithDiagnosticsOptions = LoadAgentOptions & {
  /**
   * Default options applied when {@link DiagnosticsAgent.exportDiagnostics} is called.
   * Export is never automatic — callers must invoke it explicitly.
   */
  readonly diagnostics?: DiagnosticExportOptions
}

export type DiagnosticsAgent = Agent & {
  /**
   * Explicit local diagnostics export. Does not perform network I/O.
   * Pass a prior {@link GetResult} or omit to call `get()` first.
   */
  exportDiagnostics(
    resultOrOptions?: GetResult | DiagnosticExportOptions,
    options?: DiagnosticExportOptions,
  ): Promise<DiagnosticExportResult>
}

export type LoadWithDiagnosticsResult = {
  readonly agent: DiagnosticsAgent
  readonly diagnosticsRevision: typeof DIAGNOSTICS_REVISION
  readonly defaultExportOptions: DiagnosticExportOptions
}

function isGetResult(value: unknown): value is GetResult {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as GetResult).visitorId === 'string' &&
    typeof (value as GetResult).components === 'object' &&
    (value as GetResult).components !== null
  )
}

/**
 * Opt-in loader: same collectors as {@link load}, plus an explicit
 * `exportDiagnostics` action on the agent. Default {@link load} is unchanged.
 */
export async function loadWithDiagnostics(
  options: LoadWithDiagnosticsOptions = {},
): Promise<LoadWithDiagnosticsResult> {
  const { diagnostics: defaultExportOptions = {}, ...loadOptions } = options
  const baseline = await load(loadOptions)

  const agent: DiagnosticsAgent = {
    get: (getOptions) => baseline.get(getOptions),
    async exportDiagnostics(resultOrOptions?, maybeOptions?) {
      let result: GetResult
      let exportOptions: DiagnosticExportOptions

      if (isGetResult(resultOrOptions)) {
        result = resultOrOptions
        exportOptions = { ...defaultExportOptions, ...maybeOptions }
      } else {
        exportOptions = {
          ...defaultExportOptions,
          ...(resultOrOptions ?? {}),
          ...(maybeOptions ?? {}),
        }
        result = await baseline.get()
      }

      return exportDiagnosticSnapshot(result, exportOptions)
    },
  }

  return {
    agent,
    diagnosticsRevision: DIAGNOSTICS_REVISION,
    defaultExportOptions,
  }
}
