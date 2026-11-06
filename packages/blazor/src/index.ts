export {
  identifyForBlazor,
  installNightWatchBlazorGlobal,
  type BlazorIdentifyResult,
} from './interop.js'

export {
  identify,
  createNightWatchClient,
  load,
  type NightWatchClient,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
  type GetResult,
  type LoadOptions,
} from '@thenightwatch/vanilla'

export const BLAZOR_PACKAGE_NAME = '@thenightwatch/blazor' as const
export const BLAZOR_PACKAGE_VERSION = '1.0.0' as const
