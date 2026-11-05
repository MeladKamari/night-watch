/**
 * Three-valued / multi-state evidence status.
 * Never serialize `unknown` as `false`.
 */
export type EvidenceStatus =
  | 'known'
  | 'unknown'
  | 'unsupported'
  | 'unavailable'
  | 'not_applicable'
  | 'insufficient_evidence'
  | 'provider_unavailable'
  | 'stale'
  | 'permission_denied'

export type EvidenceProvenance =
  | 'browser_sdk'
  | 'proplus_browser_adapter'
  | 'server'
  | 'edge'
  | 'offline_dataset'
  | 'operator'
  | 'derived'

/**
 * Generic evidence cell used by signals, identity, and risk.
 * `value` is null unless status is `known` (or explicitly documented otherwise).
 */
export interface EvidenceCell<T = unknown> {
  readonly status: EvidenceStatus
  readonly value: T | null
  readonly confidence: number | null
  readonly provenance: EvidenceProvenance
  readonly reason?: string
  readonly observedAt?: string
  readonly modelVersion?: string
}

export function knownEvidence<T>(
  value: T,
  provenance: EvidenceProvenance,
  confidence: number | null = null,
): EvidenceCell<T> {
  return { status: 'known', value, confidence, provenance }
}

export function unknownEvidence(
  provenance: EvidenceProvenance,
  reason?: string,
): EvidenceCell<null> {
  const cell: EvidenceCell<null> = {
    status: 'unknown',
    value: null,
    confidence: null,
    provenance,
  }
  return reason === undefined ? cell : { ...cell, reason }
}

export function unsupportedEvidence(
  provenance: EvidenceProvenance,
  reason: string,
): EvidenceCell<null> {
  return {
    status: 'unsupported',
    value: null,
    confidence: null,
    provenance,
    reason,
  }
}

export function unavailableEvidence(
  provenance: EvidenceProvenance,
  reason: string,
): EvidenceCell<null> {
  return {
    status: 'unavailable',
    value: null,
    confidence: null,
    provenance,
    reason,
  }
}

export function notApplicableNativeOnly(): EvidenceCell<null> {
  return {
    status: 'not_applicable',
    value: null,
    confidence: null,
    provenance: 'server',
    reason: 'requires_native_sdk',
  }
}
