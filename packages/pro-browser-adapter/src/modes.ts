import type { CollectionMode } from '@night-watch/contracts'
import {
  adaptGetResultToObservation,
  type AdaptGetResultOptions,
} from './adapt.js'
import type { GetResult } from '@night-watch/browser-sdk'
import { hashComponents, type UnknownComponents } from '@night-watch/core'

export type ProPlusBridgeOptions = AdaptGetResultOptions & {
  mode: CollectionMode
  fetchImpl?: typeof fetch
  endpoint?: string
  publicApiKey?: string
  signal?: AbortSignal
}

export type BridgeResult =
  | { mode: 'off' | 'browser_only'; visitorId: string; networkAttempted: false }
  | {
      mode: 'pro_plus'
      visitorId: string
      networkAttempted: true
      status: 'sent' | 'blocked_by_policy' | 'network_unavailable'
      eventId?: string
    }

/**
 * Opt-in bridge: legacy visitorId always computed locally; network only in `pro_plus` mode.
 */
export async function runProPlusBridge(
  result: Pick<GetResult, 'visitorId' | 'confidence' | 'components' | 'version'>,
  options: ProPlusBridgeOptions,
): Promise<BridgeResult> {
  const visitorId = hashComponents(result.components as UnknownComponents)
  if (visitorId !== result.visitorId) {
    throw new Error('legacy visitorId mismatch')
  }

  if (options.mode === 'off' || options.mode === 'browser_only') {
    return { mode: options.mode, visitorId, networkAttempted: false }
  }

  if (options.consentStatus === 'denied') {
    return {
      mode: 'pro_plus',
      visitorId,
      networkAttempted: true,
      status: 'blocked_by_policy',
    }
  }

  const observation = adaptGetResultToObservation(result, options)
  if (!options.endpoint || !options.fetchImpl) {
    return {
      mode: 'pro_plus',
      visitorId,
      networkAttempted: true,
      status: 'network_unavailable',
    }
  }

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'idempotency-key': options.nonce ?? `idem-${visitorId.slice(0, 16)}`,
    }
    if (options.publicApiKey) {
      headers.authorization = `Bearer ${options.publicApiKey}`
    }
    const init: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(observation),
    }
    if (options.signal !== undefined) {
      init.signal = options.signal
    }
    const response = await options.fetchImpl(options.endpoint, init)
    if (!response.ok) {
      return {
        mode: 'pro_plus',
        visitorId,
        networkAttempted: true,
        status: 'network_unavailable',
      }
    }
    const body = (await response.json()) as { eventId?: string }
    return {
      mode: 'pro_plus',
      visitorId,
      networkAttempted: true,
      status: 'sent',
      ...(body.eventId ? { eventId: body.eventId } : {}),
    }
  } catch {
    return {
      mode: 'pro_plus',
      visitorId,
      networkAttempted: true,
      status: 'network_unavailable',
    }
  }
}
