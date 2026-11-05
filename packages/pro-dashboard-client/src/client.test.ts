import { describe, expect, it, vi } from 'vitest'
import { ProPlusDashboardClient, ProPlusDashboardClientError } from './client.js'

describe('ProPlusDashboardClient auth and management', () => {
  it('login stores session/csrf and listKeys sends headers', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url)
      const headers = new Headers(init?.headers)
      if (u.includes('/v1/console/login')) {
        return new Response(
          JSON.stringify({
            sessionId: 'sess_1',
            csrfToken: 'csrf_abcdefghijklmnop',
            userId: 'u1',
            username: 'admin',
            tenantId: 'tenant_demo',
            role: 'Administrator',
            expiresAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      expect(headers.get('authorization')).toBe('Bearer sess_1')
      expect(headers.get('x-csrf-token')).toBe('csrf_abcdefghijklmnop')
      if (u.includes('/v1/management/keys') && init?.method === 'POST') {
        return new Response(JSON.stringify({ keyId: 'k1', masked: 'pk_****', status: 'active' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const c = new ProPlusDashboardClient({ baseUrl: 'http://127.0.0.1:5080/', fetchImpl })
    const login = await c.login('admin', 'admin-change-me')
    expect(login.sessionId).toBe('sess_1')
    await c.listKeys()
    const created = await c.createKey({ kind: 'Public' })
    expect(created.keyId).toBe('k1')
  })

  it('requires csrf for mutating calls', async () => {
    const c = new ProPlusDashboardClient({
      baseUrl: 'http://127.0.0.1:5080/',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })
    await expect(c.createKey({})).rejects.toBeInstanceOf(ProPlusDashboardClientError)
  })
})
