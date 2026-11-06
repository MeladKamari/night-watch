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

export const REACT_PACKAGE_NAME = '@thenightwatch/react' as const
export const REACT_PACKAGE_VERSION = '1.0.0' as const
