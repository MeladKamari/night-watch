export {
  CORE_PACKAGE_NAME,
  CORE_PACKAGE_VERSION,
} from './package-meta.js'

export {
  ENABLED_SOURCES,
  ENABLED_SOURCE_COUNT,
  EXCLUDED_UPSTREAM_SOURCE,
  RegistryInvariantError,
  SOURCE_MANIFEST_REVISION,
  UPSTREAM_PIN,
  UPSTREAM_SOURCE_COUNT,
  assertDefaultRegistryInvariants,
  isExcludedUpstreamSource,
  listEnabledSources,
  type EnabledSourceName,
} from './registry.js'

export {
  ALGORITHM_SCHEMA,
  APPLE_PAY_EXCLUDED,
  isErrorComponent,
  isValueComponent,
  type AlgorithmSchema,
  type AssertApplePayExcluded,
  type BuiltinComponents,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Component,
  type ComponentOutcomeKind,
  type Confidence,
  type MaybePromise,
  type Source,
  type SourceValue,
  type SourcesToComponents,
  type UnknownComponents,
  type UnknownSources,
} from './types.js'

export {
  UnsupportedEnvironmentError,
  assertBrowserEnvironment,
  blocked,
  getAudioContextConstructor,
  getDocument,
  getGlobalThis,
  getIntl,
  getMatchMedia,
  getNavigator,
  getOfflineAudioContextConstructor,
  getScreen,
  getSecureContext,
  getWindow,
  isBlockedBrowserError,
  isBrowserEnvironment,
  ok,
  probeError,
  probeMatchMedia,
  probeWebGlContext,
  releaseWebGlProbe,
  runProbe,
  unsupported,
  type AudioContextConstructor,
  type OfflineAudioContextConstructor,
  type ProbeResult,
  type ProbeStatus,
  type WebGlProbeOptions,
  type WebGlProbeValue,
} from './runtime/index.js'

export {
  awaitIfAsync,
  isPromise,
  mapWithBreaks,
  releaseEventLoop,
  requestIdleCallbackIfAvailable,
  suppressUnhandledRejectionWarning,
  wait,
} from './scheduler/index.js'

export {
  excludes,
  loadSource,
  loadSources,
  transformSource,
} from './collectors/index.js'

export {
  COMPONENT_ERROR_HASH_SENTINEL,
  componentHasError,
  componentValueForHash,
  errorToObject,
  isFunctionNative,
  isSensitiveKey,
  toError,
} from './errors/index.js'

export { componentsToDebugString } from './debug/index.js'

export {
  componentsToCanonicalString,
  getUTF8Bytes,
  hashComponents,
  hashComponentsOmittingExcluded,
  omitExcludedUpstreamComponents,
  x64hash128,
} from './hash/index.js'

export {
  HEURISTIC_SCORES,
  NODE_SAFE_CONFIDENCE_ENVIRONMENT,
  assertScoreInUnitInterval,
  buildHeuristicConfidenceComment,
  deriveReferenceScaleScore,
  getConfidence,
  getOpenConfidenceScore,
  heuristicPlatformConfidenceModel,
  resolveConfidenceEnvironment,
  round,
  type CalibratedConfidenceModel,
  type ConfidenceEnvironmentHints,
  type ConfidenceModel,
  type ConfidencePlatformComponents,
  type GetConfidenceOptions,
} from './confidence/index.js'

export {
  detectConfidenceEnvironmentHints,
  exitFullscreen,
  getBrowserContext,
  getFullscreenElement,
  isAndroid,
  isChromium,
  isChromium122OrNewer,
  isChromium128OrNewer,
  isChromium86OrNewer,
  isDesktopWebKit,
  isEdgeHTML,
  isGecko,
  isGecko120OrNewer,
  isGecko143OrNewer,
  isIPad,
  isSafariWebKit,
  isSamsungInternet,
  isTrident,
  isWebKit,
  isWebKit606OrNewer,
  isWebKit616OrNewer,
  type BrowserContext,
} from './browser/index.js'

export {
  DomOperationTimeoutError,
  addStyleString,
  getFrameElement,
  isAnyParentCrossOrigin,
  isCurrentFrameSandboxed,
  isFullscreenActive,
  isInIframe,
  parseSimpleCssSelector,
  selectorToElement,
  withIframe,
  type WithIframeOptions,
} from './dom/index.js'

export { replaceNaN, toFloat, toInt } from './data/to-float.js'
