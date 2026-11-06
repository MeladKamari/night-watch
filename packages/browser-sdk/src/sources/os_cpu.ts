import { getNavigator, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/** Firefox / legacy Gecko surface; absent on Chromium and Safari. */
export type NavigatorWithOsCpu = {
  readonly oscpu?: string
}

export type OsCpuOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithOsCpu | null
}

/**
 * Reads `navigator.oscpu` when present.
 * Absence (Chromium/Safari/Node) is `undefined` — a hashed value, never a fabricated CPU string.
 */
export function getOsCpuValue(options: OsCpuOptions = {}): string | undefined {
  if ('navigator' in options) {
    return readOsCpu(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return readOsCpu(navProbe.value as NavigatorWithOsCpu)
}

export function readOsCpu(navigatorLike: NavigatorWithOsCpu | null | undefined): string | undefined {
  if (navigatorLike == null) {
    return undefined
  }
  return navigatorLike.oscpu
}

/** Entropy source: legacy `navigator.oscpu` (primarily Firefox). */
export const getOsCpu: Source<BuiltinSourceOptions, string | undefined> = () => getOsCpuValue()
