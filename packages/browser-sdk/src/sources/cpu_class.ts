import { getNavigator, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Legacy IE `navigator.cpuClass` surface; absent on modern Chromium/Firefox/Safari. */
export type NavigatorWithCpuClass = {
  readonly cpuClass?: string
}

export type CpuClassOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithCpuClass | null
}

/**
 * Reads `navigator.cpuClass` when present.
 * Absence is `undefined` — never inferred from UA text or fabricated (e.g. "x86").
 */
export function getCpuClassValue(options: CpuClassOptions = {}): string | undefined {
  if ('navigator' in options) {
    return readCpuClass(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return readCpuClass(navProbe.value as NavigatorWithCpuClass)
}

export function readCpuClass(
  navigatorLike: NavigatorWithCpuClass | null | undefined,
): string | undefined {
  if (navigatorLike == null) {
    return undefined
  }
  return navigatorLike.cpuClass
}

/** Entropy source: legacy `navigator.cpuClass` (primarily old IE). */
export const getCpuClass: Source<BuiltinSourceOptions, string | undefined> = () => getCpuClassValue()
