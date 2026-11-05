import { buildDiagnosticSnapshot } from './build-snapshot.js'
import { DiagnosticsValidationError } from './errors.js'
import { validateDiagnosticSnapshot } from './validate-snapshot.js'
import type {
  DiagnosticExportOptions,
  DiagnosticExportResult,
  DiagnosticSnapshot,
} from './types.js'
import type { GetResult } from '../types.js'

/**
 * Serializes a snapshot to canonical pretty JSON (local only).
 * Does not call `fetch`, `sendBeacon`, XHR, or write storage.
 */
export function serializeDiagnosticSnapshot(snapshot: DiagnosticSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`
}

/**
 * Explicit local export action: build → validate → serialize.
 * Callers must invoke this deliberately; nothing is auto-uploaded.
 */
export function exportDiagnosticSnapshot(
  result: GetResult,
  options: DiagnosticExportOptions = {},
): DiagnosticExportResult {
  const snapshot = buildDiagnosticSnapshot(result, options)
  const validation = validateDiagnosticSnapshot(snapshot)
  if (!validation.ok) {
    throw new DiagnosticsValidationError(validation.errors)
  }
  const json = serializeDiagnosticSnapshot(validation.snapshot)
  const byteLength = utf8ByteLength(json)

  return {
    snapshot: validation.snapshot,
    json,
    byteLength,
  }
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length
  }
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/**
 * Parse + validate a previously exported JSON string (local round-trip / fixtures).
 */
export function parseDiagnosticSnapshotJson(json: string): DiagnosticSnapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    throw new DiagnosticsValidationError(['json is not valid JSON'])
  }
  const validation = validateDiagnosticSnapshot(parsed)
  if (!validation.ok) {
    throw new DiagnosticsValidationError(validation.errors)
  }
  return validation.snapshot
}
