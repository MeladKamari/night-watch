import {
  ALGORITHM_SCHEMA,
  isErrorComponent,
  isValueComponent,
  type UnknownComponents,
} from '@night-watch/core'
import { SDK_PACKAGE_VERSION } from '../package-meta.js'
import type { GetResult } from '../types.js'
import { collectRedactedEnvironment } from './environment.js'
import { redactDeep, redactErrorForDiagnostics } from './redact.js'
import { hashReproSeed, normalizeReproSeed } from './seed.js'
import {
  DIAGNOSTICS_REVISION,
  DIAGNOSTICS_SNAPSHOT_SCHEMA,
  type DiagnosticComponentSnapshot,
  type DiagnosticExportOptions,
  type DiagnosticSnapshot,
} from './types.js'

function snapshotComponents(
  components: UnknownComponents,
): Record<string, DiagnosticComponentSnapshot> {
  const out: Record<string, DiagnosticComponentSnapshot> = {}
  for (const key of Object.keys(components)) {
    const component = components[key]!
    if (isValueComponent(component)) {
      out[key] = {
        value: redactDeep(component.value),
        duration: component.duration,
      }
      continue
    }
    if (isErrorComponent(component)) {
      out[key] = {
        error: redactErrorForDiagnostics(component.error),
        duration: component.duration,
      }
      continue
    }
    // Unknown shape — record as error object, never invent a success value.
    const duration =
      typeof (component as { duration?: number }).duration === 'number'
        ? (component as { duration: number }).duration
        : 0
    out[key] = {
      error: { name: 'DiagnosticsError', message: 'Unrecognized component shape' },
      duration,
    }
  }
  return out
}

/**
 * Builds a schema-tagged, redacted diagnostic snapshot from a {@link GetResult}.
 * Local-only — performs no network I/O.
 */
export function buildDiagnosticSnapshot(
  result: GetResult,
  options: DiagnosticExportOptions = {},
): DiagnosticSnapshot {
  const components = snapshotComponents(result.components as UnknownComponents)
  const componentKeys = Object.keys(components)

  const notes: string[] = [
    `Diagnostics ${DIAGNOSTICS_REVISION}; default load()/hashComponents unchanged.`,
    'Local export only — SDK never uploads snapshots or opens analytics beacons.',
    'Page URL/title/cookies/referrer are omitted; errors are redacted.',
  ]

  if (componentKeys.includes('applePay')) {
    notes.push('WARNING: applePay key present — violates default-profile exclusion.')
  }

  const base: DiagnosticSnapshot = {
    schema: DIAGNOSTICS_SNAPSHOT_SCHEMA,
    revision: DIAGNOSTICS_REVISION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    packageVersion: options.packageVersion ?? result.version ?? SDK_PACKAGE_VERSION,
    sourceManifestRevision: ALGORITHM_SCHEMA.sourceManifestRevision,
    hashingRevision: ALGORITHM_SCHEMA.hashingRevision,
    confidenceRevision: ALGORITHM_SCHEMA.confidenceRevision,
    visitorId: result.visitorId,
    confidence: result.confidence,
    componentKeys,
    components,
    notes,
  }

  const withEnv =
    options.includeEnvironment === true
      ? { ...base, environment: collectRedactedEnvironment() }
      : base

  if (options.reproSeed === undefined) {
    return withEnv
  }

  const seed = normalizeReproSeed(options.reproSeed)
  const withHash = { ...withEnv, reproSeedHash: hashReproSeed(seed) }
  if (options.includeRawReproSeed === true) {
    return { ...withHash, reproSeed: seed }
  }
  return withHash
}
