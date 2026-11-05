export {
  FIRST_PARTY_SERVER_INTEGRATION_DESIGN,
  SERVER_INTEGRATION_DESIGN_REVISION,
  type ConsentedEvidencePayloadDesign,
  type EncryptionDesign,
  type EvidenceAuthDesign,
  type FirstPartyServerIntegrationDesign,
  type RateLimitDesign,
  type RetentionPolicyDesign,
  type ServerIntegrationDesignRevision,
  type UserDeletionRequestDesign,
} from './types.js'

/**
 * Runtime guard used in tests: the browser package must not expose a server client.
 * Returns false for known forbidden export names if present on an API bag.
 */
export function browserSdkExposesServerClient(apiKeys: readonly string[]): boolean {
  const forbidden = [
    'sendEvidence',
    'postFingerprint',
    'uploadComponents',
    'createServerClient',
    'FingerprintServer',
  ]
  return apiKeys.some((key) => forbidden.includes(key))
}
