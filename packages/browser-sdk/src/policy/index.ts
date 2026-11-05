export {
  SOURCE_CATEGORIES,
  SOURCES_BY_CATEGORY,
  assertCategoryCoverage,
  categoryForSource,
  sourcesInCategories,
  type SourceCategory,
} from './categories.js'
export {
  CollectionConsentError,
  assertConsentAllowsCollection,
  isConsentAllowingCollection,
} from './consent.js'
export {
  loadWithCollectionPolicy,
  type LoadWithCollectionPolicyOptions,
  type LoadWithCollectionPolicyResult,
} from './load-with-policy.js'
export {
  assertKnownCategories,
  describePolicyImpact,
  resolveExcludedSources,
} from './resolve-policy.js'
export type {
  CollectionPolicy,
  ConsentSignal,
  ConsentStatus,
  PolicyResolution,
} from './types.js'
