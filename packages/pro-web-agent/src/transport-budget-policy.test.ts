import { describe, expect, it, vi } from 'vitest'
import { FirstPartyTransport } from './transport.js'
import { CollectionBudgetRunner, importLocalChunk } from './budgets.js'
import { BrowserCollectionPolicy } from './policy.js'

describe('FirstPartyTransport', () => {
  it('validates schema version, offline fixture, and 429 mapping', async () => {
    const t = new FirstPartyTransport({
      baseUrl: '/api',
      publicProjectKey: 'pk_test',
      sameOriginOnly: false,
      offlineFixture: { status: 200, body: { ok: true } },
    })
    const bad = await t.postJson('/observations', { hello: 1 })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.problem.title).toBe('schema_version_required')

    const ok = await t.postJson('/observations', { schemaVersion: 'obs-1', data: {} })
    expect(ok.ok).toBe(true)

    const limited = new FirstPartyTransport({
      baseUrl: 'https://app.example/fp',
      publicProjectKey: 'pk',
      sameOriginOnly: false,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ title: 'slow' }), {
          status: 429,
          headers: { 'content-type': 'application/problem+json', 'retry-after': '2' },
        })) as typeof fetch,
    })
    const r = await limited.postJson('/observations', { schemaVersion: 'obs-1' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problem.status).toBe(429)
      expect(r.retryAfterMs).toBe(2000)
    }
  })

  it('blocks credentials in URL', () => {
    expect(
      () =>
        new FirstPartyTransport({
          baseUrl: 'https://user:pass@evil.example',
          publicProjectKey: 'pk',
          sameOriginOnly: false,
        }),
    ).toThrow(/credentials/)
  })
})

describe('CollectionBudgetRunner', () => {
  it('isolates timeouts and blocked APIs; rejects CDN import', async () => {
    const runner = new CollectionBudgetRunner({
      deadlineMs: 5_000,
      signals: [
        { signalId: 'canvas', timeoutMs: 30 },
        { signalId: 'audio', timeoutMs: 30 },
        { signalId: 'fonts', timeoutMs: 30, skip: true },
      ],
    })

    const { outcomes, warnings } = await runner.run({
      canvas: async () => 'ok',
      audio: async () => {
        await new Promise((r) => setTimeout(r, 80))
        return 'late'
      },
      fonts: async () => {
        throw new Error('should_skip')
      },
    })

    expect(outcomes.find((o) => o.signalId === 'canvas')?.status).toBe('ok')
    expect(outcomes.find((o) => o.signalId === 'audio')?.status).toBe('timeout')
    expect(outcomes.find((o) => o.signalId === 'fonts')?.status).toBe('skipped')
    expect(warnings.some((w) => w.startsWith('timeout:'))).toBe(true)

    await expect(importLocalChunk('https://cdn.example/x.js')).rejects.toThrow(/cdn/)
  })
})

describe('BrowserCollectionPolicy', () => {
  it('denies ingest by default and clears queue on revoke', () => {
    const policy = new BrowserCollectionPolicy()
    const changes: string[] = []
    policy.onPolicyChanged((s) => changes.push(s.decision))

    expect(policy.tryEnqueueObservation('fraud_prevention', { a: 1 })).toBe(false)
    expect(policy.stats().ingestCalls).toBe(0)
    expect(policy.stats().persistentWrites).toBe(0)

    policy.configure({
      version: 'v1',
      decision: 'allow',
      purposes: ['fraud_prevention'],
    })
    expect(policy.tryEnqueueObservation('fraud_prevention', { a: 1 })).toBe(true)
    expect(policy.stats().ingestCalls).toBe(1)

    policy.revoke()
    expect(policy.stats().queueLength).toBe(0)
    expect(policy.tryEnqueueObservation('fraud_prevention', { a: 2 })).toBe(false)
    expect(changes).toContain('allow')
    expect(changes).toContain('deny')
  })
})
