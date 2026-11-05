import {
  ENABLED_SOURCE_COUNT,
  SOURCE_MANIFEST_REVISION,
  errorToObject,
  isErrorComponent,
  isValueComponent,
  type GetResult,
  type UnknownComponents,
} from '@night-watch/browser-sdk'
import { summarizeError, summarizeValue } from './format.js'

export type SignalKind = 'value' | 'error'

export type SignalRow = {
  readonly key: string
  readonly kind: SignalKind
  readonly summary: string
  readonly durationMs: number
  /** JSON-safe payload for copy/export (not fed back into hashing). */
  readonly exportValue: unknown
}

export type PlaygroundSnapshot = {
  readonly visitorId: string
  readonly confidenceScore: number
  readonly confidenceComment: string | undefined
  readonly version: string
  readonly sourceManifestRevision: string
  readonly enabledSourceCount: number
  readonly collectedAtIso: string
  readonly signals: readonly SignalRow[]
  /** Keys whose component is an error arm (includes unsupported / blocked failures). */
  readonly errorKeys: readonly string[]
}

export function snapshotFromResult(
  result: GetResult,
  collectedAt: Date = new Date(),
): PlaygroundSnapshot {
  const signals = componentsToSignalRows(result.components)
  return {
    visitorId: result.visitorId,
    confidenceScore: result.confidence.score,
    confidenceComment: result.confidence.comment,
    version: result.version,
    sourceManifestRevision: SOURCE_MANIFEST_REVISION,
    enabledSourceCount: ENABLED_SOURCE_COUNT,
    collectedAtIso: collectedAt.toISOString(),
    signals,
    errorKeys: signals.filter((row) => row.kind === 'error').map((row) => row.key),
  }
}

export function componentsToSignalRows(components: UnknownComponents): SignalRow[] {
  const rows: SignalRow[] = []
  for (const key of Object.keys(components)) {
    const component = components[key]
    if (!component) {
      continue
    }
    if (isValueComponent(component)) {
      rows.push({
        key,
        kind: 'value',
        summary: summarizeValue(component.value),
        durationMs: component.duration,
        exportValue: component.value,
      })
      continue
    }
    if (isErrorComponent(component)) {
      rows.push({
        key,
        kind: 'error',
        summary: summarizeError(component.error),
        durationMs: component.duration,
        exportValue: serializeErrorExport(component.error),
      })
    }
  }
  return rows
}

export function snapshotToCopyJson(snapshot: PlaygroundSnapshot): string {
  const components: Record<string, unknown> = {}
  for (const row of snapshot.signals) {
    components[row.key] = {
      kind: row.kind,
      durationMs: row.durationMs,
      value: row.kind === 'value' ? row.exportValue : undefined,
      error: row.kind === 'error' ? row.exportValue : undefined,
    }
  }
  return `${JSON.stringify(
    {
      visitorId: snapshot.visitorId,
      confidence: {
        score: snapshot.confidenceScore,
        comment: snapshot.confidenceComment,
      },
      version: snapshot.version,
      sourceManifestRevision: snapshot.sourceManifestRevision,
      enabledSourceCount: snapshot.enabledSourceCount,
      collectedAt: snapshot.collectedAtIso,
      errorKeys: snapshot.errorKeys,
      components,
    },
    null,
    2,
  )}\n`
}

function serializeErrorExport(error: unknown): unknown {
  if (error instanceof Error) {
    return errorToObject(error)
  }
  return error
}
