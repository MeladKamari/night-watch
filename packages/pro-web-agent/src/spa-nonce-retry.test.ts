import { describe, expect, it } from 'vitest'
import { SpaLifecycleController } from './spa.js'
import { NonceReceiptClient, ServerNonceStore } from './nonce-receipt.js'
import { BoundedRetryController } from './retry-offline.js'

describe('SpaLifecycleController', () => {
  it('coalesces parallel identify and StrictMode dispose', async () => {
    const spa = new SpaLifecycleController()
    let calls = 0
    const fn = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 20))
      return { eventId: `e${calls}` }
    }
    const [a, b] = await Promise.all([spa.identify('id-1', fn), spa.identify('id-1', fn)])
    expect(calls).toBe(1)
    expect(a.deduped || b.deduped).toBe(true)
    expect(spa.getServerEventCount()).toBe(1)

    // double-mount simulate
    spa.dispose()
    const spa2 = new SpaLifecycleController()
    await spa2.identify('id-1', fn)
    expect(calls).toBe(2)
  })
})

describe('NonceReceiptClient', () => {
  it('rejects replay and client cannot claim verified receipt', () => {
    const client = new NonceReceiptClient()
    const now = Date.now()
    client.acceptChallenge({
      nonce: 'n1',
      audience: 'ingest',
      tenantId: 't1',
      projectId: 'p1',
      expiresAt: now + 60_000,
    }, now)
    expect(client.bindObservation('ingest', 't1', 'p1', now)).toBe('n1')
    expect(() => client.bindObservation('ingest', 't1', 'p1', now)).toThrow(/replay/)
    expect(client.inspectReceipt('zt1.abc.sig')).toBe('unverified_client_side')

    const server = new ServerNonceStore()
    expect(server.consume('n1', now + 60_000, now)).toBe('ok')
    expect(server.consume('n1', now + 60_000, now)).toBe('replay')
  })
})

describe('BoundedRetryController', () => {
  it('bounds attempts and clears on revoke; offline queues opaque handles', async () => {
    const r = new BoundedRetryController({ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 })
    r.setNetworkState('offline')
    expect(await r.runAttempt('h1', async () => 'ok')).toBe('queued')
    expect(r.queueSize()).toBe(1)
    r.setNetworkState('online')
    expect(await r.runAttempt('h1', async () => 'retry')).toBe('queued')
    expect(await r.runAttempt('h1', async () => 'retry')).toBe('give_up')
    r.clearOnRevoke()
    expect(r.queueSize()).toBe(0)
    r.abortOnNavigation()
    expect(await r.runAttempt('h2', async () => 'ok')).toBe('aborted')
  })
})
