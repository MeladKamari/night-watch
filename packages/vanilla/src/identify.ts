import { load, type GetResult, type LoadAgentOptions } from '@night-watch/browser-sdk'

/**
 * One-shot collect: `load()` then `get()`.
 * Monitoring stays off unless the caller opts in (still a no-op in this SDK).
 */
export async function identify(options: Readonly<LoadAgentOptions> = {}): Promise<GetResult> {
  const agent = await load({
    monitoring: false,
    ...options,
  })
  return agent.get()
}
