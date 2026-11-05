import { ENABLED_SOURCES } from '@night-watch/core'
import { PRO_WEB_AGENT_PROTOCOL_VERSION } from './types.js'
import type { CollectionPolicyState } from './policy.js'

export type SourceAvailability = {
  sourceId: string
  available: boolean
  latencyMs?: number
  errorCategory?: string
}

export type RedactedDiagnosticEvent = {
  protocolVersion: typeof PRO_WEB_AGENT_PROTOCOL_VERSION
  sourceCount: number
  sources: SourceAvailability[]
  consentDecision?: string
  proRequestAttempted: boolean
  notes: string[]
}

/** Opt-in diagnostics — never includes raw fingerprint values or tokens. */
export function buildRedactedDiagnostics(input: {
  availability: SourceAvailability[]
  policy?: CollectionPolicyState
  proRequestAttempted: boolean
}): RedactedDiagnosticEvent {
  return {
    protocolVersion: PRO_WEB_AGENT_PROTOCOL_VERSION,
    sourceCount: ENABLED_SOURCES.length,
    sources: input.availability.map((s) => ({
      sourceId: s.sourceId,
      available: s.available,
      ...(s.latencyMs !== undefined ? { latencyMs: s.latencyMs } : {}),
      ...(s.errorCategory !== undefined ? { errorCategory: s.errorCategory } : {}),
    })),
    ...(input.policy ? { consentDecision: input.policy.decision } : {}),
    proRequestAttempted: input.proRequestAttempted,
    notes: [
      'raw_fingerprint_values_omitted',
      'tokens_omitted',
      'private_ip_omitted',
      `expected_sources=${ENABLED_SOURCES.length}`,
    ],
  }
}

export function defaultAvailabilityStub(): SourceAvailability[] {
  return ENABLED_SOURCES.map((id) => ({ sourceId: id, available: true }))
}
