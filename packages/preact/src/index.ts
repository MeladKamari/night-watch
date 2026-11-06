export { useVisitorData, type UseVisitorDataOptions, type UseVisitorDataResult } from './use-visitor-data.js'

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

export const PREACT_PACKAGE_NAME = '@thenightwatch/preact' as const
export const PREACT_PACKAGE_VERSION = '1.0.0' as const
