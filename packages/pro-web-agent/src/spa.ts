export type SpaIdentifyFn = (idempotencyKey: string) => Promise<{ eventId?: string }>

/**
 * SPA lifecycle helper: pageview OFF by default; coalesces parallel identify; aborts stale nav.
 */
export class SpaLifecycleController {
  private disposed = false
  private pageviewEnabled = false
  private inFlight: Promise<{ eventId?: string }> | null = null
  private lastIdem: string | null = null
  private navGeneration = 0
  private readonly seenKeys = new Set<string>()
  private serverEvents = 0

  enablePageviewTracking(on: boolean): void {
    this.pageviewEnabled = on
  }

  onRouteChange(_path: string): void {
    if (this.disposed) return
    this.navGeneration += 1
    // Stale in-flight work is abandoned by generation check in identify
    if (this.pageviewEnabled) {
      // opt-in only — still uses same identify coalescing
      void this.identify(`pageview:${_path}:${this.navGeneration}`, async () => ({}))
    }
  }

  async identify(idempotencyKey: string, fn: SpaIdentifyFn): Promise<{ eventId?: string; deduped: boolean }> {
    if (this.disposed) throw new Error('disposed')
    if (this.seenKeys.has(idempotencyKey) && this.lastIdem === idempotencyKey) {
      return { deduped: true }
    }
    if (this.inFlight && this.lastIdem === idempotencyKey) {
      const r = await this.inFlight
      return { ...r, deduped: true }
    }

    const gen = this.navGeneration
    this.lastIdem = idempotencyKey
    this.inFlight = (async () => {
      const result = await fn(idempotencyKey)
      if (gen !== this.navGeneration) {
        return {}
      }
      this.seenKeys.add(idempotencyKey)
      if (result.eventId) this.serverEvents += 1
      return result
    })()

    try {
      const result = await this.inFlight
      return { ...result, deduped: false }
    } finally {
      this.inFlight = null
    }
  }

  /** StrictMode double-mount safe dispose */
  dispose(): void {
    this.disposed = true
    this.inFlight = null
    this.seenKeys.clear()
  }

  getServerEventCount(): number {
    return this.serverEvents
  }
}
