import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import {
  createNightWatchClient,
  type NightWatchClientOptions,
  type NightWatchSnapshot,
} from '@night-watch/vanilla'

export type UseVisitorDataOptions = NightWatchClientOptions & {
  enabled?: boolean
}

export type UseVisitorDataResult = NightWatchSnapshot & {
  refresh: () => Promise<void>
}

/** Preact hook mirroring `@night-watch/react`'s `useVisitorData`. */
export function useVisitorData(options: UseVisitorDataOptions = {}): UseVisitorDataResult {
  const { enabled = true, ...clientOptions } = options
  const optionsKey = JSON.stringify(clientOptions)
  const client = useMemo(
    () => createNightWatchClient(clientOptions),
    // optionsKey captures serializable opts
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
