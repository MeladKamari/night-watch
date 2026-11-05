import {
  blocked,
  isBlockedBrowserError,
  ok,
  probeError,
  runProbe,
  unsupported,
  type ProbeResult,
} from './probe.js'

/**
 * True when a browser `window` global appears to be available.
 * Safe to call from Node: does not throw; does not assume fingerprinting will succeed.
 */
export function isBrowserEnvironment(): boolean {
  try {
    const g = globalThis as typeof globalThis & { window?: unknown }
    return typeof g.window === 'object' && g.window !== null
  } catch {
    return false
  }
}

export class UnsupportedEnvironmentError extends Error {
  override readonly name = 'UnsupportedEnvironmentError'

  constructor(message = 'Browser environment is required for fingerprint collection') {
    super(message)
  }
}

/**
 * Throws {@link UnsupportedEnvironmentError} when not running with a usable `window`.
 * Call at agent `load()` time — never at module import.
 */
export function assertBrowserEnvironment(): void {
  if (!isBrowserEnvironment()) {
    throw new UnsupportedEnvironmentError()
  }
}

/** On-demand `globalThis` accessor (always present in ES2018+ hosts). */
export function getGlobalThis(): ProbeResult<typeof globalThis> {
  return runProbe(typeof globalThis !== 'undefined', () => globalThis)
}

/** Whether this realm exposes a boolean `isSecureContext` flag. */
export function getSecureContext(): ProbeResult<boolean> {
  if (!isBrowserEnvironment()) {
    return unsupported()
  }
  try {
    const g = globalThis as typeof globalThis & { window?: Window; isSecureContext?: boolean }
    const w = g.window
    if (w && typeof w.isSecureContext === 'boolean') {
      return ok(w.isSecureContext)
    }
    if (typeof g.isSecureContext === 'boolean') {
      return ok(g.isSecureContext)
    }
    return unsupported()
  } catch (error) {
    if (isBlockedBrowserError(error)) {
      return blocked(error instanceof Error ? error.name : 'blocked', error)
    }
    return probeError(error)
  }
}
