import { load, type GetResult } from '@thenightwatch/browser-sdk'
import { ENABLED_SOURCES } from '@thenightwatch/core'
import { runProPlusBridge } from '@thenightwatch/browser-adapter'
import type { CollectionMode } from '@thenightwatch/contracts'
import {
  PRO_WEB_AGENT_PROTOCOL_VERSION,
  type GetCallOptions,
  type ProAgentEvent,
  type ProAgentEventType,
  type ProAgentOptions,
  type ProAgentState,
  type ProVisitorData,
} from './types.js'

const KNOWN_OPTION_KEYS = new Set([
  'mode',
  'endpoint',
  'publicApiKey',
  'purpose',
  'consentStatus',
  'telemetry',
  'protocolVersion',
  'loadFn',
  'fetchImpl',
])

type LegacyAgent = { get: (opts?: object) => Promise<GetResult> }

/**
 * Standalone Pro+ web agent. Wraps legacy load()/get() without mutating visitorId.
 * Side-by-side safe: no globals written.
 */
export class ProWebAgent {
  private state: ProAgentState = 'idle'
  private legacy: LegacyAgent | null = null
  private last: ProVisitorData | null = null
  private flight: Promise<ProVisitorData> | null = null
  private readonly listeners = new Map<ProAgentEventType, Set<(e: ProAgentEvent) => void>>()
  private readonly opts: Required<
    Pick<ProAgentOptions, 'mode' | 'purpose' | 'consentStatus' | 'telemetry'>
  > &
    ProAgentOptions

  constructor(options: ProAgentOptions = {}) {
    rejectUnknownOptions(options)
    if (
      options.protocolVersion !== undefined &&
      options.protocolVersion !== PRO_WEB_AGENT_PROTOCOL_VERSION
    ) {
      throw new TypeError(`unsupported protocolVersion: ${options.protocolVersion}`)
    }

    this.opts = {
      mode: options.mode ?? 'browser_only',
      purpose: options.purpose ?? 'fraud_prevention',
      consentStatus: options.consentStatus ?? 'unknown',
      telemetry: options.telemetry ?? false,
      ...options,
    }
  }

  getState(): ProAgentState {
    return this.state
  }

  on(event: ProAgentEventType, callback: (e: ProAgentEvent) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
    return () => set!.delete(callback)
  }

  async start(options: ProAgentOptions = {}): Promise<void> {
    rejectUnknownOptions(options)
    if (this.state === 'stopped') {
      throw new Error('agent_stopped')
    }
    if (this.state === 'ready' || this.state === 'collecting') {
      return
    }

    this.setState('starting')
    try {
      const loadFn = options.loadFn ?? this.opts.loadFn ?? load
      this.legacy = await loadFn()
      // Merge late options without unknown keys
      Object.assign(this.opts, {
        mode: options.mode ?? this.opts.mode,
        endpoint: options.endpoint ?? this.opts.endpoint,
        publicApiKey: options.publicApiKey ?? this.opts.publicApiKey,
        purpose: options.purpose ?? this.opts.purpose,
        consentStatus: options.consentStatus ?? this.opts.consentStatus,
        telemetry: options.telemetry ?? this.opts.telemetry,
        fetchImpl: options.fetchImpl ?? this.opts.fetchImpl,
      })
      this.setState('ready')
    } catch (err) {
      this.setState('error')
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit({ type: 'error', error })
      throw error
    }
  }

  async get(call: GetCallOptions = {}): Promise<ProVisitorData> {
    if (this.state === 'stopped') throw new Error('agent_stopped')
    if (!this.legacy) await this.start()
    if (this.flight) return this.flight

    this.flight = this.collect(call).finally(() => {
      this.flight = null
    })
    return this.flight
  }

  /** Alias: identify() === get() for Pro API familiarity (not vendor-compatible). */
  identify(call: GetCallOptions = {}): Promise<ProVisitorData> {
    return this.get(call)
  }

  getVisitorData(): ProVisitorData | null {
    return this.last
  }

  clearTransientState(): void {
    this.last = null
    this.flight = null
  }

  stop(): void {
    this.clearTransientState()
    this.legacy = null
    this.setState('stopped')
  }

  /** Contract helper for tests: frozen 41-source set. */
  static expectedSourceCount(): number {
    return ENABLED_SOURCES.length
  }

  private async collect(call: GetCallOptions): Promise<ProVisitorData> {
    this.setState('collecting')
    const signal = call.signal
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const timeoutMs = call.timeout
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise =
      timeoutMs !== undefined
        ? new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
          })
        : null

    try {
      const resultPromise = this.legacy!.get({})
      const result = timeoutPromise
        ? await Promise.race([resultPromise, timeoutPromise])
        : await resultPromise

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const mode = this.opts.mode as CollectionMode
      const bridgeOpts: Parameters<typeof runProPlusBridge>[1] = {
        mode,
        purpose: this.opts.purpose,
        consentStatus: this.opts.consentStatus,
      }
      if (this.opts.endpoint !== undefined) bridgeOpts.endpoint = this.opts.endpoint
      if (this.opts.publicApiKey !== undefined) bridgeOpts.publicApiKey = this.opts.publicApiKey
      if (!(this.opts.telemetry === false && mode !== 'pro_plus') && this.opts.fetchImpl !== undefined) {
        bridgeOpts.fetchImpl = this.opts.fetchImpl
      }
      if (signal !== undefined) bridgeOpts.signal = signal
      if (call.eventContext?.nonce !== undefined) bridgeOpts.nonce = call.eventContext.nonce
      const bridge = await runProPlusBridge(result, bridgeOpts)

      // When mode is off / browser_only, bridge guarantees networkAttempted false
      const data: ProVisitorData = {
        visitorId: result.visitorId,
        confidence: result.confidence,
        components: result.components,
        version: result.version,
        protocolVersion: PRO_WEB_AGENT_PROTOCOL_VERSION,
        networkAttempted: bridge.networkAttempted,
      }

      if (Object.prototype.hasOwnProperty.call(result.components, 'applePay')) {
        throw new Error('applePay must not appear in components')
      }

      this.last = data
      this.emit({ type: 'visitor', data })
      this.setState('ready')
      return data
    } catch (err) {
      this.setState('error')
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit({ type: 'error', error })
      throw error
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  private setState(state: ProAgentState): void {
    this.state = state
    this.emit({ type: 'state', state })
  }

  private emit(event: ProAgentEvent): void {
    const set = this.listeners.get(event.type)
    if (!set) return
    for (const cb of set) cb(event)
  }
}

export function createProWebAgent(options?: ProAgentOptions): ProWebAgent {
  return new ProWebAgent(options)
}

function rejectUnknownOptions(options: object): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTION_KEYS.has(key)) {
      throw new TypeError(`unknown option: ${key}`)
    }
  }
}
