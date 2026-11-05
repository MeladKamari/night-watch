export type Challenge = {
  nonce: string
  audience: string
  tenantId: string
  projectId: string
  expiresAt: number
}

export type ReceiptStatus = 'present' | 'missing' | 'unverified_client_side'

/**
 * Client-side nonce binder. Signing secrets never live in the browser.
 * Receipts are opaque transport; server verifies.
 */
export class NonceReceiptClient {
  private used = new Set<string>()
  private challenge: Challenge | null = null

  acceptChallenge(ch: Challenge, now = Date.now()): void {
    if (ch.expiresAt <= now) throw new Error('challenge_expired')
    this.challenge = ch
  }

  bindObservation(audience: string, tenantId: string, projectId: string, now = Date.now()): string {
    if (!this.challenge) throw new Error('no_challenge')
    if (this.challenge.expiresAt <= now) throw new Error('challenge_expired')
    if (this.challenge.audience !== audience || this.challenge.tenantId !== tenantId || this.challenge.projectId !== projectId) {
      throw new Error('challenge_mismatch')
    }
    if (this.used.has(this.challenge.nonce)) throw new Error('nonce_replay_client')
    this.used.add(this.challenge.nonce)
    return this.challenge.nonce
  }

  /** Client cannot forge verification — only reports transport status. */
  inspectReceipt(receipt: string | null | undefined): ReceiptStatus {
    if (!receipt) return 'missing'
    return 'unverified_client_side'
  }

  clear(): void {
    this.challenge = null
  }
}

/** Server-side double-check helper for tests (mirrors API behavior). */
export class ServerNonceStore {
  private seen = new Set<string>()

  consume(nonce: string, expiresAt: number, now = Date.now()): 'ok' | 'expired' | 'replay' {
    if (expiresAt <= now) return 'expired'
    if (this.seen.has(nonce)) return 'replay'
    this.seen.add(nonce)
    return 'ok'
  }
}
