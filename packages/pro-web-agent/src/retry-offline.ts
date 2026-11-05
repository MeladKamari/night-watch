export type RetryState = 'online' | 'offline' | 'timeout' | 'dns_missing'

export type RetryQueueItem = {
  handle: string
  attempts: number
  nextAt: number
}

export type BoundedRetryOptions = {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  persistQueue?: boolean
}

/**
 * Bounded retry for Iran-like intermittent first-party networks.
 * Volatile memory by default; no long-lived raw fingerprint payloads.
 */
export class BoundedRetryController {
  private readonly maxAttempts: number
  private readonly baseDelayMs: number
  private readonly maxDelayMs: number
  private readonly persistQueue: boolean
  private queue: RetryQueueItem[] = []
  private aborted = false
  private state: RetryState = 'online'

  constructor(opts: BoundedRetryOptions = {}) {
    this.maxAttempts = opts.maxAttempts ?? 4
    this.baseDelayMs = opts.baseDelayMs ?? 200
    this.maxDelayMs = opts.maxDelayMs ?? 5_000
    this.persistQueue = opts.persistQueue ?? false
  }

  getState(): RetryState {
    return this.state
  }

  setNetworkState(state: RetryState): void {
    this.state = state
  }

  abortOnNavigation(): void {
    this.aborted = true
    this.queue = []
  }

  clearOnRevoke(): void {
    this.queue = []
  }

  enqueueOpaqueHandle(handle: string, now = Date.now()): boolean {
    if (this.aborted) return false
    if (this.queue.some((q) => q.handle === handle)) return false
    if (this.queue.length >= 20) return false
    this.queue.push({ handle, attempts: 0, nextAt: now })
    if (this.persistQueue) {
      // Explicit tenant policy only — still stores opaque handles, never raw fingerprint
    }
    return true
  }

  async runAttempt(
    handle: string,
    send: () => Promise<'ok' | 'retry' | 'fail'>,
    retryAfterMs?: number,
    now = Date.now(),
  ): Promise<'ok' | 'give_up' | 'queued' | 'aborted'> {
    if (this.aborted) return 'aborted'
    if (this.state === 'offline' || this.state === 'dns_missing') {
      this.enqueueOpaqueHandle(handle, now)
      return 'queued'
    }

    const item = this.queue.find((q) => q.handle === handle) ?? { handle, attempts: 0, nextAt: now }
    if (item.attempts >= this.maxAttempts) return 'give_up'

    const result = await send()
    item.attempts += 1
    if (result === 'ok') {
      this.queue = this.queue.filter((q) => q.handle !== handle)
      return 'ok'
    }
    if (result === 'fail' || item.attempts >= this.maxAttempts) {
      this.queue = this.queue.filter((q) => q.handle !== handle)
      return 'give_up'
    }

    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.max(0, item.attempts - 1))
    const jitter = Math.floor(Math.random() * (exp * 0.2))
    item.nextAt = now + (retryAfterMs ?? exp + jitter)
    if (!this.queue.some((q) => q.handle === handle)) this.queue.push(item)
    else {
      const idx = this.queue.findIndex((q) => q.handle === handle)
      if (idx >= 0) this.queue[idx] = item
    }
    return 'queued'
  }

  queueSize(): number {
    return this.queue.length
  }
}
