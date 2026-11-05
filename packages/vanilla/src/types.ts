import type { GetResult, LoadAgentOptions } from '@night-watch/browser-sdk'

export type NightWatchStatus = 'idle' | 'loading' | 'ready' | 'error'

export type NightWatchClientOptions = Readonly<
  LoadAgentOptions & {
    /**
     * When true, the first `identify()` starts automatically on client creation
     * (browser only). Defaults to false.
     */
    immediate?: boolean
  }
>

export type NightWatchSnapshot = {
  readonly status: NightWatchStatus
  readonly visitorId: string | null
  readonly version: string | null
  readonly result: GetResult | null
  readonly error: Error | null
}

export type NightWatchClient = {
  readonly options: NightWatchClientOptions
  /** Collect once (cached) or force a fresh run. */
  identify: (force?: boolean) => Promise<GetResult>
  /** Drop the in-memory cache. */
  clear: () => void
  /** Last settled snapshot (sync; may be idle before first identify). */
  getSnapshot: () => NightWatchSnapshot
  /** Subscribe to snapshot changes. Returns unsubscribe. */
  subscribe: (listener: (snapshot: NightWatchSnapshot) => void) => () => void
}
