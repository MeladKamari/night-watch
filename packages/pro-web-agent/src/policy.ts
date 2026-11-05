export type PolicyDecision = 'allow' | 'deny' | 'unknown'

export type CollectionPolicyState = {
  version: string
  decision: PolicyDecision
  purposes: readonly string[]
  consentEvidence?: string
  expiresAt?: string
  restrictHighEntropy?: boolean
  restrictRawSignals?: boolean
}

export type PolicyChangeHandler = (state: CollectionPolicyState) => void

/**
 * Browser policy provider. Default denies networked Pro collection until configured.
 */
export class BrowserCollectionPolicy {
  private state: CollectionPolicyState
  private readonly handlers = new Set<PolicyChangeHandler>()
  private queue: unknown[] = []
  private ingestCalls = 0
  private persistentWrites = 0

  constructor(initial?: Partial<CollectionPolicyState>) {
    const state: CollectionPolicyState = {
      version: initial?.version ?? 'policy-v0',
      decision: initial?.decision ?? 'deny',
      purposes: initial?.purposes ?? [],
      restrictHighEntropy: initial?.restrictHighEntropy ?? true,
      restrictRawSignals: initial?.restrictRawSignals ?? true,
    }
    if (initial?.consentEvidence !== undefined) state.consentEvidence = initial.consentEvidence
    if (initial?.expiresAt !== undefined) state.expiresAt = initial.expiresAt
    this.state = state
  }

  getState(): CollectionPolicyState {
    return this.state
  }

  onPolicyChanged(handler: PolicyChangeHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  configure(next: CollectionPolicyState): void {
    this.state = next
    this.emit()
  }

  revoke(): void {
    this.queue = []
    const next: CollectionPolicyState = {
      version: `${this.state.version}+revoked`,
      decision: 'deny',
      purposes: this.state.purposes,
      restrictHighEntropy: this.state.restrictHighEntropy ?? true,
      restrictRawSignals: this.state.restrictRawSignals ?? true,
    }
    if (this.state.expiresAt !== undefined) next.expiresAt = this.state.expiresAt
    this.state = next
    this.emit()
  }

  reset(): void {
    this.queue = []
    this.ingestCalls = 0
    this.persistentWrites = 0
    this.state = {
      version: 'policy-v0',
      decision: 'deny',
      purposes: [],
      restrictHighEntropy: true,
      restrictRawSignals: true,
    }
    this.emit()
  }

  canNetworkCollect(purpose: string): boolean {
    if (this.isExpired()) return false
    if (this.state.decision !== 'allow') return false
    return this.state.purposes.includes(purpose)
  }

  /** Attempt Pro ingest — increments counters only when allowed. */
  tryEnqueueObservation(purpose: string, observation: unknown): boolean {
    if (!this.canNetworkCollect(purpose)) {
      return false
    }
    this.queue.push(observation)
    this.ingestCalls += 1
    this.persistentWrites += 1
    return true
  }

  stats(): { ingestCalls: number; persistentWrites: number; queueLength: number } {
    return {
      ingestCalls: this.ingestCalls,
      persistentWrites: this.persistentWrites,
      queueLength: this.queue.length,
    }
  }

  private isExpired(): boolean {
    if (!this.state.expiresAt) return false
    return Date.parse(this.state.expiresAt) <= Date.now()
  }

  private emit(): void {
    for (const h of this.handlers) h(this.state)
  }
}
