import { load, type GetResult, type LoadOptions } from '@thenightwatch/browser-sdk'

export type CollectOptions = {
  /** Idle fallback ms; playground default matches SDK (50). */
  delayFallback?: number
  debug?: boolean
}

/**
 * Independent collection: fresh `load()` + `get()` each call (no shared agent cache).
 * Monitoring is always forced off — playground never phones home.
 */
export async function collectFingerprint(options: CollectOptions = {}): Promise<GetResult> {
  const loadOptions: LoadOptions = {
    monitoring: false,
    delayFallback: options.delayFallback ?? 50,
    ...(options.debug === true ? { debug: true as const } : {}),
  }
  const agent = await load(loadOptions)
  return agent.get()
}
