export { useVisitorData, type UseVisitorDataOptions, type UseVisitorDataReturn } from './use-visitor-data.js'

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

export const VUE_PACKAGE_NAME = '@thenightwatch/vue' as const
export const VUE_PACKAGE_VERSION = '1.0.0' as const
