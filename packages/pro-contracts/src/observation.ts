import {
  IDENTITY_ALGORITHM_VERSION,
  PROCESSING_VERSION,
  PRODUCT_CODE,
} from './product.js'
import type { EvidenceCell } from './evidence.js'

/** Legacy browser SDK visitorId (local hash) — never silently replaced. */
export interface LegacyBrowserIdentity {
  readonly visitorId: string
  readonly sourceManifestRevision: string
  readonly hashingRevision: string
  readonly confidenceScore: number | null
  readonly confidenceComment?: string
  readonly componentKeys: readonly string[]
  readonly sdkPackageVersion: string
}

/** Server-assigned opaque visitor identity (future backend). */
export interface ServerVisitorIdentity {
  readonly visitorId: string
  readonly identityAlgorithmVersion: typeof IDENTITY_ALGORITHM_VERSION
  readonly matchType: 'exact' | 'probable' | 'ambiguous' | 'new' | 'unknown'
  readonly identityConfidence: EvidenceCell<number | null>
  readonly firstSeenAt: string | null
  readonly lastSeenAt: string | null
}

export interface ObservationEnvelope {
  readonly productCode: typeof PRODUCT_CODE
  readonly processingVersion: typeof PROCESSING_VERSION
  readonly identityAlgorithmVersion: typeof IDENTITY_ALGORITHM_VERSION
  readonly purpose: string
  readonly consentStatus: 'granted' | 'denied' | 'unknown' | 'not_required'
  readonly collectedAt: string
  readonly legacyBrowser: LegacyBrowserIdentity
  readonly nonce?: string
  readonly tenantHint?: string
  readonly projectHint?: string
}

export type SignalEvaluationMap = Record<string, EvidenceCell>
