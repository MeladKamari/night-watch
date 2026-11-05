export type TransportConfig = {
  baseUrl: string
  publicProjectKey: string
  timeoutMs?: number
  endpointVersion?: string
  allowedHeaders?: readonly string[]
  sameOriginOnly?: boolean
  maxBodyBytes?: number
  fetchImpl?: typeof fetch
  /** Offline fixture mode: never calls network */
  offlineFixture?: { status: number; body: unknown }
}

export type TransportProblem = {
  type: string
  title: string
  status: number
  detail?: string
  requestId?: string
}

export type TransportResult =
  | { ok: true; status: number; body: unknown; requestId?: string }
  | { ok: false; problem: TransportProblem; retryAfterMs?: number }

const DEFAULT_HEADERS = ['content-type', 'authorization', 'idempotency-key', 'x-request-id'] as const

/**
 * Hardened first-party HTTP transport. Rejects third-party absolute URLs by default.
 */
export class FirstPartyTransport {
  private readonly cfg: Required<
    Pick<TransportConfig, 'timeoutMs' | 'endpointVersion' | 'sameOriginOnly' | 'maxBodyBytes'>
  > &
    TransportConfig

  constructor(config: TransportConfig) {
    assertSafeBaseUrl(config.baseUrl, config.sameOriginOnly !== false)
    this.cfg = {
      timeoutMs: config.timeoutMs ?? 8_000,
      endpointVersion: config.endpointVersion ?? 'v1',
      sameOriginOnly: config.sameOriginOnly !== false,
      maxBodyBytes: config.maxBodyBytes ?? 64_000,
      ...config,
      allowedHeaders: config.allowedHeaders ?? DEFAULT_HEADERS,
    }
  }

  async postJson(path: string, body: unknown, headers: Record<string, string> = {}): Promise<TransportResult> {
    const payload = JSON.stringify(body)
    if (new TextEncoder().encode(payload).length > this.cfg.maxBodyBytes) {
      return {
        ok: false,
        problem: { type: 'about:blank', title: 'payload_too_large', status: 413 },
      }
    }

    if (!isVersionedBody(body)) {
      return {
        ok: false,
        problem: { type: 'about:blank', title: 'schema_version_required', status: 400 },
      }
    }

    if (this.cfg.offlineFixture) {
      const status = this.cfg.offlineFixture.status
      if (status >= 200 && status < 300) {
        return { ok: true, status, body: this.cfg.offlineFixture.body }
      }
      return {
        ok: false,
        problem: { type: 'about:blank', title: 'offline_fixture_error', status },
      }
    }

    const url = joinUrl(this.cfg.baseUrl, `/${this.cfg.endpointVersion}${path.startsWith('/') ? path : `/${path}`}`)
    if (this.cfg.sameOriginOnly) {
      assertSameOriginOrRelative(url, this.cfg.baseUrl)
    }

    const safeHeaders: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.cfg.publicProjectKey}`,
      'x-request-id': headers['x-request-id'] ?? cryptoRandomId(),
    }
    for (const [k, v] of Object.entries(headers)) {
      const key = k.toLowerCase()
      if (!(this.cfg.allowedHeaders ?? DEFAULT_HEADERS).map((h) => h.toLowerCase()).includes(key)) {
        continue
      }
      safeHeaders[key] = v
    }

    const fetchImpl = this.cfg.fetchImpl ?? globalThis.fetch
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs)
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: safeHeaders,
        body: payload,
        signal: ctrl.signal,
        redirect: 'error',
      })

      const requestId = res.headers.get('x-request-id') ?? safeHeaders['x-request-id']
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'))

      if (res.status === 429 || res.status === 503) {
        const problem: TransportProblem = {
          type: 'about:blank',
          title: res.status === 429 ? 'rate_limited' : 'unavailable',
          status: res.status,
        }
        if (requestId) problem.requestId = requestId
        const out: TransportResult = { ok: false, problem }
        if (retryAfter !== undefined) (out as { retryAfterMs?: number }).retryAfterMs = retryAfter
        return out
      }

      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok) {
        if (ct.includes('application/problem+json')) {
          const problem = (await res.json()) as TransportProblem
          const merged: TransportProblem = { ...problem, status: problem.status || res.status }
          if (requestId) merged.requestId = requestId
          return { ok: false, problem: merged }
        }
        const problem: TransportProblem = { type: 'about:blank', title: 'http_error', status: res.status }
        if (requestId) problem.requestId = requestId
        return { ok: false, problem }
      }

      if (!ct.includes('application/json')) {
        const problem: TransportProblem = {
          type: 'about:blank',
          title: 'unexpected_content_type',
          status: res.status,
        }
        if (requestId) problem.requestId = requestId
        return { ok: false, problem }
      }

      const success: { ok: true; status: number; body: unknown; requestId?: string } = {
        ok: true,
        status: res.status,
        body: await res.json(),
      }
      if (requestId) success.requestId = requestId
      return success
    } catch (err) {
      return {
        ok: false,
        problem: {
          type: 'about:blank',
          title: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network_error',
          status: 0,
        },
      }
    } finally {
      clearTimeout(timer)
    }
  }
}

function isVersionedBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'schemaVersion' in body &&
    typeof (body as { schemaVersion: unknown }).schemaVersion === 'string'
  )
}

function assertSafeBaseUrl(baseUrl: string, sameOriginOnly: boolean): void {
  if (baseUrl.startsWith('/')) return
  let u: URL
  try {
    u = new URL(baseUrl)
  } catch {
    throw new TypeError('invalid_base_url')
  }
  if (u.username || u.password) throw new TypeError('credentials_in_url_forbidden')
  if (sameOriginOnly && typeof globalThis.location !== 'undefined') {
    if (u.origin !== globalThis.location.origin) {
      throw new TypeError('third_party_base_url_forbidden')
    }
  }
}

function assertSameOriginOrRelative(url: string, baseUrl: string): void {
  if (url.startsWith('/')) return
  const target = new URL(url, baseUrl.startsWith('http') ? baseUrl : 'http://local.invalid')
  if (baseUrl.startsWith('http')) {
    const base = new URL(baseUrl)
    if (target.origin !== base.origin) throw new TypeError('third_party_request_blocked')
  }
}

function joinUrl(base: string, path: string): string {
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path
  if (!base.endsWith('/') && !path.startsWith('/')) return `${base}/${path}`
  return base + path
}

function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined
  const n = Number(h)
  if (Number.isFinite(n)) return n * 1000
  return undefined
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(8)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
