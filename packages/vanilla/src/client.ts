import type { GetResult } from '@night-watch/browser-sdk'
import { identify } from './identify.js'
import type {
  NightWatchClient,
  NightWatchClientOptions,
  NightWatchSnapshot,
} from './types.js'

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function idleSnapshot(): NightWatchSnapshot {
  return {
    status: 'idle',
    visitorId: null,
    version: null,
    result: null,
    error: null,
  }
}

/**
 * Stateful Night Watch client with in-memory cache + subscribe API.
 * Safe to construct under SSR; collection only runs when `identify()` is called
 * (or `immediate: true` in a browser).
 */
export function createNightWatchClient(
  options: NightWatchClientOptions = {},
): NightWatchClient {
  const { immediate = false, ...loadOptions } = options
  let snapshot = idleSnapshot()
  let inflight: Promise<GetResult> | undefined
  const listeners = new Set<(s: NightWatchSnapshot) => void>()

  const emit = (next: NightWatchSnapshot): void => {
    snapshot = next
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const runIdentify = async (force: boolean): Promise<GetResult> => {
    if (!force && snapshot.status === 'ready' && snapshot.result) {
      return snapshot.result
    }
    if (!force && inflight) {
      return inflight
    }

    emit({
      status: 'loading',
      visitorId: snapshot.visitorId,
      version: snapshot.version,
      result: snapshot.result,
      error: null,
    })

    inflight = identify(loadOptions)
      .then((result) => {
        emit({
          status: 'ready',
          visitorId: result.visitorId,
          version: result.version,
          result,
          error: null,
        })
        return result
      })
      .catch((err: unknown) => {
        const error = toError(err)
        emit({
          status: 'error',
          visitorId: null,
          version: null,
          result: null,
          error,
        })
        throw error
      })
      .finally(() => {
        inflight = undefined
      })

    return inflight
  }

  const client: NightWatchClient = {
    options,
    identify: (force = false) => runIdentify(force),
    clear: () => {
      inflight = undefined
      emit(idleSnapshot())
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(snapshot)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  if (immediate && typeof globalThis !== 'undefined') {
    const g = globalThis as { window?: unknown; document?: unknown }
    if (typeof g.window === 'object' && g.window !== null) {
      void runIdentify(false).catch(() => {
        /* snapshot already holds the error */
      })
    }
  }

  return client
}
