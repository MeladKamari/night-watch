import { createProWebAgent, type ProWebAgent } from './agent.js'
import type { ProAgentOptions } from './types.js'

/** SSR-safe: returns null on server; never touches window during SSR. */
export function isBrowserRuntime(): boolean {
  return typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined'
}

export function createAgentBrowserOnly(options?: ProAgentOptions): ProWebAgent | null {
  if (!isBrowserRuntime()) return null
  return createProWebAgent(options)
}

/** React-style hook shape (framework-agnostic factory). */
export function createReactAgentHook(options?: ProAgentOptions) {
  let agent: ProWebAgent | null = null
  return {
    useProAgent(): ProWebAgent | null {
      if (!isBrowserRuntime()) return null
      if (!agent) agent = createProWebAgent(options)
      return agent
    },
    dispose(): void {
      agent?.stop()
      agent = null
    },
  }
}

/** Vue composable-shaped factory. */
export function createVueProAgent(options?: ProAgentOptions) {
  const agent = createAgentBrowserOnly(options)
  return {
    agent,
    async identify() {
      if (!agent) return null
      return agent.identify()
    },
    stop() {
      agent?.stop()
    },
  }
}

/** Angular-like injectable lifecycle wrapper. */
export class AngularProAgentService {
  private agent: ProWebAgent | null = null

  constructor(private readonly options?: ProAgentOptions) {}

  init(): ProWebAgent | null {
    this.agent = createAgentBrowserOnly(this.options)
    return this.agent
  }

  ngOnDestroy(): void {
    this.agent?.stop()
    this.agent = null
  }
}

/** Next.js client-only dynamic loader stub. */
export async function loadProAgentForNext(options?: ProAgentOptions): Promise<ProWebAgent | null> {
  if (!isBrowserRuntime()) return null
  const agent = createProWebAgent(options)
  await agent.start()
  return agent
}
