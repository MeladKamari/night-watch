export { identify } from './identify.js'
export { createNightWatchClient } from './client.js'
export type {
  NightWatchClient,
  NightWatchClientOptions,
  NightWatchSnapshot,
  NightWatchStatus,
} from './types.js'

export {
  load,
  hashComponents,
  componentsToDebugString,
  ENABLED_SOURCES,
  ENABLED_SOURCE_COUNT,
  SOURCE_MANIFEST_REVISION,
  type Agent,
  type GetResult,
  type LoadOptions,
  type LoadAgentOptions,
  type GetOptions,
} from '@thenightwatch/browser-sdk'

export const VANILLA_PACKAGE_NAME = '@thenightwatch/vanilla' as const
export const VANILLA_PACKAGE_VERSION = '1.0.0' as const
