export {
  CONTRACTS_PACKAGE_NAME,
  CONTRACTS_PACKAGE_VERSION,
  IDENTITY_ALGORITHM_VERSION,
  NPM_SCOPE,
  PROCESSING_VERSION,
  PRODUCT_CODE,
  PRODUCT_NAME,
  PRODUCT_PUBLIC_LABEL,
} from './product.js'

export {
  knownEvidence,
  notApplicableNativeOnly,
  unavailableEvidence,
  unknownEvidence,
  unsupportedEvidence,
  type EvidenceCell,
  type EvidenceProvenance,
  type EvidenceStatus,
} from './evidence.js'

export type {
  LegacyBrowserIdentity,
  ObservationEnvelope,
  ServerVisitorIdentity,
  SignalEvaluationMap,
} from './observation.js'

export {
  CONTRACT_SCHEMA_VERSIONS,
  assertPayloadSize,
  validateErrorEnvelope,
  validateIdentificationEvent,
  validateObservation,
  type ContractValidationIssue,
  type ContractValidationResult,
} from './validation.js'

export {
  DEFAULT_PRIVACY_POLICY,
  assertPurposeAllowed,
  type CollectionMode,
  type LawfulPurposeId,
  type PrivacyPolicyDocument,
} from './privacy.js'
