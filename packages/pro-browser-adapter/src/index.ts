export {
  adaptGetResultToObservation,
  expectedLegacySourceCount,
  type AdaptGetResultOptions,
} from './adapt.js'

export {
  runProPlusBridge,
  type BridgeResult,
  type ProPlusBridgeOptions,
} from './modes.js'

export const BROWSER_ADAPTER_PACKAGE_NAME = '@night-watch/browser-adapter' as const
export const BROWSER_ADAPTER_PACKAGE_VERSION = '1.0.0' as const
