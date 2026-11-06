import {
  ALGORITHM_SCHEMA,
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
  hashComponents,
  type UnknownComponents,
} from '@thenightwatch/core'
import type { GetResult } from '@thenightwatch/browser-sdk'
import {
  IDENTITY_ALGORITHM_VERSION,
  PROCESSING_VERSION,
  PRODUCT_CODE,
  type LegacyBrowserIdentity,
  type ObservationEnvelope,
} from '@thenightwatch/contracts'

export type AdaptGetResultOptions = {
  purpose: string
  consentStatus: ObservationEnvelope['consentStatus']
  collectedAt?: string
  nonce?: string
  tenantHint?: string
  projectHint?: string
}

/**
 * Maps a legacy SDK {@link GetResult} into a ProPlus observation envelope.
 * Does **not** re-hash or mutate components; asserts visitorId matches `hashComponents`.
 */
export function adaptGetResultToObservation(
  result: Pick<GetResult, 'visitorId' | 'confidence' | 'components' | 'version'>,
  options: AdaptGetResultOptions,
): ObservationEnvelope {
  const expected = hashComponents(result.components as UnknownComponents)
  if (result.visitorId !== expected) {
    throw new Error(
      'Legacy visitorId does not match hashComponents(components); refusing to adapt mutated identity',
    )
  }

  if (Object.prototype.hasOwnProperty.call(result.components, 'applePay')) {
    throw new Error('applePay must not appear in adapted components')
  }

  const legacy: LegacyBrowserIdentity = {
    visitorId: result.visitorId,
    sourceManifestRevision: SOURCE_MANIFEST_REVISION,
    hashingRevision: ALGORITHM_SCHEMA.hashingRevision,
    confidenceScore: result.confidence.score,
    componentKeys: Object.keys(result.components),
    sdkPackageVersion: result.version,
    ...(result.confidence.comment !== undefined
      ? { confidenceComment: result.confidence.comment }
      : {}),
  }

  return {
    productCode: PRODUCT_CODE,
    processingVersion: PROCESSING_VERSION,
    identityAlgorithmVersion: IDENTITY_ALGORITHM_VERSION,
    purpose: options.purpose,
    consentStatus: options.consentStatus,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    legacyBrowser: legacy,
    ...(options.nonce !== undefined ? { nonce: options.nonce } : {}),
    ...(options.tenantHint !== undefined ? { tenantHint: options.tenantHint } : {}),
    ...(options.projectHint !== undefined ? { projectHint: options.projectHint } : {}),
  }
}

/** Confirms adapter depends on the frozen 41-source set. */
export function expectedLegacySourceCount(): number {
  return ENABLED_SOURCES.length
}
