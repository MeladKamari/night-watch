import type { CollectionMode } from '@thenightwatch/contracts'
import type { GetResult } from '@thenightwatch/browser-sdk'

export const PRO_WEB_AGENT_PROTOCOL_VERSION = 'night-watch-web-agent/1' as const

export type ProAgentState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'collecting'
  | 'stopped'
  | 'error'

export type ProAgentOptions = {
  mode?: CollectionMode
  endpoint?: string
  publicApiKey?: string
  purpose?: string
  consentStatus?: 'granted' | 'denied' | 'unknown' | 'not_required'
  telemetry?: boolean
  protocolVersion?: string
  /** Injected for tests — defaults to @thenightwatch/browser-sdk load */
  loadFn?: () => Promise<{ get: (opts?: object) => Promise<GetResult> }>
  fetchImpl?: typeof fetch
}

export type GetCallOptions = {
  eventContext?: Record<string, string>
  signal?: AbortSignal
  timeout?: number
}

export type ProVisitorData = {
  visitorId: string
  confidence: GetResult['confidence']
  components: GetResult['components']
  version: string
  protocolVersion: typeof PRO_WEB_AGENT_PROTOCOL_VERSION
  networkAttempted: boolean
}

export type ProAgentEvent =
  | { type: 'state'; state: ProAgentState }
  | { type: 'error'; error: Error }
  | { type: 'visitor'; data: ProVisitorData }

export type ProAgentEventType = ProAgentEvent['type']
