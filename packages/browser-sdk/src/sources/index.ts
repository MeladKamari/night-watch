export { createBuiltinSources } from './builtin.js'
export {
  mergeBuiltinSources,
  type MergeSourcesOptions,
} from './merge-sources.js'
export { SourceNotImplementedError } from './not-implemented.js'
export {
  extendComponents,
  omitComponents,
  withComponent,
  type ExtendComponentsOptions,
} from '../components/extend.js'
export {
  FONT_BASE_FAMILIES,
  FONT_CANDIDATE_LIST,
  FONT_PROBE_SIZE,
  FONT_PROBE_STRING,
  getFonts,
  probeFontsInDocument,
  type FontBaseFamily,
  type FontCandidateName,
  type FontProbeOptions,
} from './fonts.js'
export {
  DOM_BLOCKER_MATCH_THRESHOLD,
  collectDomBlockers,
  getBlockedSelectors,
  getDomBlockers,
  getFilters,
  isDomBlockersApplicable,
  type DomBlockerFilters,
  type DomBlockersCollectOptions,
} from './dom_blockers.js'
export {
  FONT_PREFERENCES_DEFAULT_TEXT,
  FONT_PREFERENCES_IFRAME_HTML,
  FONT_PREFERENCE_PRESETS,
  collectFontPreferences,
  getFontPreferences,
  measureFontPreferencesInContainer,
  normalizeFontMeasurement,
  withNaturalFonts,
  type FontPreferencesResult,
  type MeasureFontPreferencesOptions,
} from './font_preferences.js'
export {
  AUDIO_HASH_FROM_INDEX,
  AUDIO_HASH_TO_INDEX,
  AUDIO_SAMPLE_RATE,
  SpecialFingerprint,
  doesBrowserPerformAntifingerprinting,
  doesBrowserSuspendAudioContext,
  getAudio,
  getAudioFingerprintValue,
  getHash,
  getUnstableAudioFingerprint,
  type AudioFingerprintOptions,
  type SpecialFingerprintCode,
} from './audio.js'
export {
  getCurrentScreenFrame,
  getScreenFrame,
  getScreenFrameBackupForTests,
  getScreenFrameValue,
  getUnstableScreenFrame,
  isFrameSizeNull,
  resetScreenFrameWatch,
  screenFrameCheckInterval,
  type FrameSize,
  type ScreenFrameOptions,
} from './screen_frame.js'
export {
  CANVAS_PRINTED_TEXT,
  ImageStatus,
  doesBrowserPerformAntiFingerprinting,
  doesSupportWinding,
  getCanvas,
  getCanvasFingerprint,
  getUnstableCanvasFingerprint,
  renderGeometryImage,
  renderTextImage,
  type CanvasFingerprint,
  type CanvasFingerprintOptions,
  type ImageStatusCode,
} from './canvas.js'
export {
  getOsCpu,
  getOsCpuValue,
  readOsCpu,
  type NavigatorWithOsCpu,
  type OsCpuOptions,
} from './os_cpu.js'
export {
  collectLanguages,
  getLanguages,
  getLanguagesValue,
  type LanguagesOptions,
  type NavigatorWithLanguages,
} from './languages.js'
export {
  getColorDepth,
  getColorDepthValue,
  readColorDepth,
  type ColorDepthOptions,
  type ScreenWithColorDepth,
} from './color_depth.js'
export {
  getDeviceMemory,
  getDeviceMemoryValue,
  readDeviceMemory,
  type DeviceMemoryOptions,
  type NavigatorWithDeviceMemory,
} from './device_memory.js'
export {
  getScreenResolution,
  getScreenResolutionValue,
  getUnstableScreenResolution,
  type ScreenResolution,
  type ScreenResolutionOptions,
} from './screen_resolution.js'
export {
  getHardwareConcurrency,
  getHardwareConcurrencyValue,
  getUnstableHardwareConcurrency,
  readHardwareConcurrency,
  type HardwareConcurrencyOptions,
  type NavigatorWithHardwareConcurrency,
} from './hardware_concurrency.js'
export {
  getTimezone,
  getTimezoneOffsetMinutes,
  getTimezoneValue,
  type OffsetDateCtor,
  type TimezoneOptions,
} from './timezone.js'
export {
  getSessionStorage,
  getSessionStorageValue,
  probeSessionStorage,
  type SessionStorageOptions,
  type WindowWithSessionStorage,
} from './session_storage.js'
export {
  getLocalStorage,
  getLocalStorageValue,
  probeLocalStorage,
  type LocalStorageOptions,
  type WindowWithLocalStorage,
} from './local_storage.js'
export {
  getIndexedDB,
  getIndexedDBValue,
  probeIndexedDB,
  type IndexedDBOptions,
  type WindowWithIndexedDB,
} from './indexed_db.js'
export {
  getOpenDatabase,
  getOpenDatabaseValue,
  probeOpenDatabase,
  type OpenDatabaseOptions,
  type WindowWithOpenDatabase,
} from './open_database.js'
export {
  getCpuClass,
  getCpuClassValue,
  readCpuClass,
  type CpuClassOptions,
  type NavigatorWithCpuClass,
} from './cpu_class.js'
export {
  getPlatform,
  getPlatformValue,
  type NavigatorWithPlatform,
  type PlatformOptions,
} from './platform.js'
export {
  collectPlugins,
  getPlugins,
  getPluginsValue,
  type MimeTypeLike,
  type PluginArrayLike,
  type PluginData,
  type PluginLike,
  type PluginMimeTypeData,
  type PluginsOptions,
} from './plugins.js'
export {
  getTouchSupport,
  getTouchSupportValue,
  probeTouchEvent,
  probeTouchStart,
  readMaxTouchPoints,
  type DocumentWithCreateEvent,
  type NavigatorWithTouch,
  type TouchSupport,
  type TouchSupportOptions,
} from './touch_support.js'
export {
  getVendor,
  getVendorValue,
  readVendor,
  type NavigatorWithVendor,
  type VendorOptions,
} from './vendor.js'
export {
  VENDOR_FLAVOR_KEYS,
  collectVendorFlavors,
  getVendorFlavors,
  getVendorFlavorsValue,
  type VendorFlavorKey,
  type VendorFlavorsOptions,
  type WindowWithVendorFlavors,
} from './vendor_flavors.js'
export {
  COOKIE_TEST_NAME,
  getCookiesEnabled,
  getCookiesEnabledValue,
  probeCookiesEnabled,
  type CookiesEnabledOptions,
  type DocumentWithCookie,
} from './cookies_enabled.js'
export {
  COLOR_GAMUT_ORDER,
  detectColorGamut,
  getColorGamut,
  getColorGamutValue,
  type ColorGamut,
  type ColorGamutOptions,
  type MatchMediaLike,
} from './color_gamut.js'
export {
  detectInvertedColors,
  getInvertedColors,
  getInvertedColorsValue,
  type InvertedColorsOptions,
} from './inverted_colors.js'
export {
  detectForcedColors,
  getForcedColors,
  getForcedColorsValue,
  type ForcedColorsOptions,
} from './forced_colors.js'
export {
  MONOCHROME_MAX_VALUE_TO_CHECK,
  detectMonochromeDepth,
  getMonochrome,
  getMonochromeValue,
  type MonochromeOptions,
} from './monochrome.js'
export {
  ContrastPreference,
  detectContrastPreference,
  getContrast,
  getContrastValue,
  type ContrastOptions,
  type ContrastPreferenceCode,
} from './contrast.js'
export {
  detectReducedMotion,
  getReducedMotion,
  getReducedMotionValue,
  type ReducedMotionOptions,
} from './reduced_motion.js'
export {
  detectReducedTransparency,
  getReducedTransparency,
  getReducedTransparencyValue,
  type ReducedTransparencyOptions,
} from './reduced_transparency.js'
export {
  detectHdr,
  getHdr,
  getHdrValue,
  type HdrOptions,
} from './hdr.js'
export {
  MATH_FINGERPRINT_KEYS,
  collectMathFingerprint,
  getMath,
  getMathValue,
  type MathFingerprint,
  type MathFingerprintKey,
  type MathLike,
  type MathOptions,
} from './math.js'
export {
  getPdfViewerEnabled,
  getPdfViewerEnabledValue,
  readPdfViewerEnabled,
  type NavigatorWithPdfViewerEnabled,
  type PdfViewerEnabledOptions,
} from './pdf_viewer_enabled.js'
export {
  collectArchitecture,
  getArchitecture,
  getArchitectureValue,
  resolveNativeTypedArrays,
  type ArchitectureOptions,
  type ArchitectureTypedArrays,
} from './architecture.js'
export {
  getPrivateClickMeasurement,
  getPrivateClickMeasurementValue,
  probePrivateClickMeasurement,
  readPrivateClickMeasurement,
  type AnchorWithAttribution,
  type DocumentWithCreateAnchor,
  type PrivateClickMeasurementOptions,
} from './private_click_measurement.js'
export {
  BaseLatencySpecialFingerprint,
  closeAudioContext,
  getAudioBaseLatency,
  getAudioBaseLatencyValue,
  isAudioBaseLatencyPlatformAllowed,
  type AudioBaseLatencyOptions,
  type AudioContextWithBaseLatency,
  type AudioContextWithBaseLatencyConstructor,
  type BaseLatencySpecialFingerprintCode,
} from './audio_base_latency.js'
export {
  DateTimeLocaleStatus,
  collectDateTimeLocale,
  getDateTimeLocale,
  getDateTimeLocaleValue,
  type DateTimeFormatLike,
  type DateTimeLocaleOptions,
  type DateTimeLocaleResult,
  type DateTimeLocaleStatusCode,
  type IntlWithDateTimeFormat,
} from './date_time_locale.js'
export {
  STATUS_GET_PARAMETER_NOT_A_FUNCTION,
  STATUS_NO_GL_CONTEXT,
  disposeWebGlCache,
  getConstantsFromPrototype,
  getWebGLContext,
  getWebGlBasics,
  getWebGlBasicsValue,
  getWebGlExtensions,
  getWebGlExtensionsValue,
  shouldAvoidDebugRendererInfo,
  shouldAvoidPolygonModeExtensions,
  type WebGlBasicsOptions,
  type WebGlBasicsPayload,
  type WebGlBasicsResult,
  type WebGlCacheBag,
  type WebGlCacheEntry,
  type WebGlExtensionsOptions,
  type WebGlExtensionsPayload,
  type WebGlExtensionsResult,
  type WebGlSpecialStatus,
} from './webgl.js'
export {
  HighEntropyStatus,
  collectUserAgentData,
  getUserAgentData,
  isGreaseBrand,
  type HighEntropyStatusCode,
  type NavigatorUAData,
  type StableUserAgentData,
} from './user_agent_data.js'
