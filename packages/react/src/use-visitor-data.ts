import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createNightWatchClient,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
} from '@thenightwatch/vanilla'

export type UseVisitorDataOptions = NightWatchClientOptions & {
  /** When false, skips auto-collect on mount. Default true in the browser. */
  enabled?: boolean
}

export type UseVisitorDataResult = NightWatchSnapshot & {
  /** Re-run collection (bypasses cache). */
  refresh: () => Promise<void>
}

/**
 * React hook: loads Night Watch once (cached) and exposes visitorId + status.
 * SSR-safe: stays `idle` until mounted in a browser when `enabled` is true.
 */
export function useVisitorData(options: UseVisitorDataOptions = {}): UseVisitorDataResult {
  const { enabled = true, ...clientOptions } = options
  const optionsKey = JSON.stringify(clientOptions)
  const client = useMemo(
    () => createNightWatchClient(clientOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsKey captures serializable opts
    [optionsKey],
  )

  const [snapshot, setSnapshot] = useState<NightWatchSnapshot>(() => client.getSnapshot())
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const unsub = client.subscribe((next) => {
      if (mounted.current) setSnapshot(next)
    })
    return () => {
      mounted.current = false
      unsub()
    }
  }, [client])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    void client.identify(false).catch(() => {
      /* error is on snapshot */
    })
  }, [client, enabled])

  const refresh = useCallback(async () => {
    await client.identify(true)
  }, [client])

  return { ...snapshot, refresh }
}
