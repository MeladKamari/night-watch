export {
  UnsupportedEnvironmentError,
  assertBrowserEnvironment,
  getGlobalThis,
  getSecureContext,
  isBrowserEnvironment,
} from './environment.js'

export {
  getDocument,
  getIntl,
  getMatchMedia,
  getNavigator,
  getScreen,
  getWindow,
  probeMatchMedia,
} from './globals.js'

export {
  getAudioContextConstructor,
  getOfflineAudioContextConstructor,
  probeWebGlContext,
  releaseWebGlProbe,
  type AudioContextConstructor,
  type OfflineAudioContextConstructor,
  type WebGlProbeOptions,
  type WebGlProbeValue,
} from './media.js'

export {
  blocked,
  isBlockedBrowserError,
  ok,
  probeError,
  runProbe,
  unsupported,
  type ProbeResult,
  type ProbeStatus,
} from './probe.js'
