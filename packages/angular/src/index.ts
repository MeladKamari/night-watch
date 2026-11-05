export {
  NightWatchService,
  NIGHT_WATCH_OPTIONS,
  provideNightWatch,
} from './night-watch.service.js'

export {
  identify,
  createNightWatchClient,
  load,
  type NightWatchClient,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
  type GetResult,
  type LoadOptions,
} from '@night-watch/vanilla'

export const ANGULAR_PACKAGE_NAME = '@night-watch/angular' as const
export const ANGULAR_PACKAGE_VERSION = '1.0.0' as const
