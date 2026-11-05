import { PRODUCT_PUBLIC_LABEL, type EvidenceStatus } from '@night-watch/contracts'

export type DashboardClientConfig = {
  readonly baseUrl: string
  readonly accessToken?: string
  readonly tenantId?: string
  readonly sessionId?: string
  readonly csrfToken?: string
  readonly fetchImpl?: typeof fetch
  readonly credentials?: RequestCredentials
}

export type ManagementHealth = {
  readonly productLabel: typeof PRODUCT_PUBLIC_LABEL
  readonly apiStatus: EvidenceStatus
  readonly message: string
  readonly modules?: readonly string[]
}

export type MetaResponse = {
  readonly product: string
  readonly productCode: string
  readonly modules: readonly string[]
  readonly applePay: string
  readonly runtimeVendorSaas: boolean
}

export type EventSearchHit = {
  readonly eventId: string
  readonly visitorId: string
  readonly linkedId?: string | null
  readonly signalStatus: string
  readonly suspectStatus: string
  readonly riskBand: string
  readonly source: string
  readonly networkAsnStatus: string
  readonly networkAsn?: string | null
  readonly createdAt: string
  readonly profile: string
}

export type EventSearchPage = {
  readonly items: readonly EventSearchHit[]
  readonly nextCursor?: string | null
  readonly hasMore: boolean
  readonly plannerHint?: string
  readonly audited?: number
}

export type ConsoleLoginResult = {
  readonly sessionId: string
  readonly csrfToken: string
  readonly userId: string
  readonly username: string
  readonly tenantId: string
  readonly role: string
  readonly expiresAt: string
}

export type ApiKeyItem = {
  readonly keyId?: string
  readonly kind?: string
  readonly prefix?: string
  readonly masked?: string
  readonly status?: string
  readonly secretOnce?: string
  readonly KeyId?: string
  readonly Kind?: number | string
  readonly Prefix?: string
  readonly Revoked?: boolean
}

export type FraudCaseItem = {
  readonly caseId: string
  readonly status: string
  readonly assignee: string
  readonly maker?: string
  readonly highRisk?: boolean
}

export type RulesDocument = {
  readonly tenantId: string
  readonly revision: string
  readonly rules: readonly { ruleId: string; priority: number; action: string; dryRun: boolean; scope?: string | null }[]
}

export type RulePublishInput = {
  readonly revision?: string
  readonly rules: readonly {
    ruleId: string
    priority?: number
    action: string
    dryRun?: boolean
    scope?: string | null
    when?: { field: string; op: string; value?: unknown }
  }[]
}

export type WebhookItem = {
  readonly subscriptionId: string
  readonly environmentId?: string
  readonly targetUrl: string
  readonly eventFilters?: readonly string[]
  readonly enabled?: boolean
  readonly secretOnce?: string
  readonly secretMasked?: string
}

export type WebhookDeliveryItem = {
  readonly deliveryId: string
  readonly subscriptionId: string
  readonly eventType: string
  readonly status: string
  readonly attempts: number
  readonly lastError?: string | null
}

export type ProjectItem = {
  readonly projectId: string
  readonly tenantId: string
  readonly name: string
  readonly revision: number
  readonly retentionDays: number
}

export type AuditItem = {
  readonly auditId: string
  readonly actor: string
  readonly role: string
  readonly action: string
  readonly resourceType: string
  readonly resourceId: string
  readonly at: string
  readonly signature: string
}

export type UsageSnapshot = {
  readonly tenantId: string
  readonly projectId: string
  readonly environmentId: string
  readonly used: number
  readonly unit: string
}

export type GraphEdgeItem = {
  readonly edgeId: string
  readonly from: string
  readonly to: string
  readonly edgeType: string
  readonly evidenceStatus: string
  readonly confidence?: number | null
  readonly effectiveConfidence: number
  readonly decayNote: string
  readonly investigationOnly: boolean
}

export type GraphSnapshot = {
  readonly tenantId: string
  readonly halfLifeDays: number
  readonly edges: readonly GraphEdgeItem[]
  readonly ringLeads: readonly {
    componentId: string
    nodeIds: readonly string[]
    score: number
    status: string
    explanations: readonly string[]
  }[]
  readonly disclaimer: string
}

export type ScoreExplainResult = {
  readonly tenantId: string
  readonly version: string
  readonly score: number
  readonly decision: string
  readonly mode: string
  readonly scoreKind: string
  readonly facets?: Readonly<Record<string, number>>
  readonly contributions: readonly {
    signalId: string
    weight: number
    appliedPoints: number
    triState: string
    kind: string
    reasonCode?: string | null
  }[]
  readonly unknownSignals: readonly string[]
  readonly reasonCodes: readonly string[]
  readonly receipt: string
}

export type PrivacyExportResult = {
  readonly visitorId?: string
  readonly [key: string]: unknown
}

export class ProPlusDashboardClientError extends Error {
  override readonly name = 'ProPlusDashboardClientError'
  constructor(
    message: string,
    readonly code: 'not_configured' | 'unauthorized' | 'network_unavailable' | 'http_error' | 'csrf',
  ) {
    super(message)
  }
}

export class ProPlusDashboardClient {
  private baseUrl: URL
  private accessToken: string | undefined
  private tenantId: string | undefined
  private sessionId: string | undefined
  private csrfToken: string | undefined
  private readonly fetchImpl: typeof fetch | undefined
  private readonly credentials: RequestCredentials

  constructor(config: DashboardClientConfig) {
    this.baseUrl = new URL(config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`)
    this.accessToken = config.accessToken
    this.tenantId = config.tenantId
    this.sessionId = config.sessionId
    this.csrfToken = config.csrfToken
    this.fetchImpl = config.fetchImpl
    this.credentials = config.credentials ?? 'include'
  }

  setSession(sessionId: string, csrfToken: string, tenantId?: string): void {
    this.sessionId = sessionId
    this.csrfToken = csrfToken
    if (tenantId) this.tenantId = tenantId
  }

  clearSession(): void {
    this.sessionId = undefined
    this.csrfToken = undefined
  }

  describeLocalHealth(): ManagementHealth {
    return {
      productLabel: PRODUCT_PUBLIC_LABEL,
      apiStatus: 'unavailable',
      message: 'Local-only mode (no network)',
    }
  }

  async login(username: string, password: string): Promise<ConsoleLoginResult> {
    const body = await this.sendJson<ConsoleLoginResult>('POST', '/v1/console/login', { username, password }, false)
    this.setSession(body.sessionId, body.csrfToken, body.tenantId)
    return body
  }

  async logout(): Promise<void> {
    try {
      await this.sendJson('POST', '/v1/console/logout', {}, true)
    } finally {
      this.clearSession()
    }
  }

  async me(): Promise<ConsoleLoginResult> {
    return this.sendJson<ConsoleLoginResult>('GET', '/v1/console/me')
  }

  async ping(): Promise<ManagementHealth> {
    return this.sendJson<ManagementHealth>('GET', '/v1/management/health')
  }

  async getMeta(): Promise<MetaResponse> {
    return this.sendJson<MetaResponse>('GET', '/v1/meta')
  }

  async listEvents(query: { visitorId?: string; eventId?: string; limit?: number } = {}): Promise<EventSearchPage> {
    const path = new URL('v1/events', this.baseUrl)
    if (query.visitorId) path.searchParams.set('visitorId', query.visitorId)
    if (query.eventId) path.searchParams.set('eventId', query.eventId)
    if (query.limit !== undefined) path.searchParams.set('limit', String(query.limit))
    return this.sendJson<EventSearchPage>('GET', path.pathname + path.search)
  }

  async listKeys(environmentId = 'dev'): Promise<{ items: ApiKeyItem[] }> {
    return this.sendJson('GET', `/v1/management/keys?environmentId=${encodeURIComponent(environmentId)}`)
  }

  async createKey(input: {
    kind?: string
    environmentId?: string
    scopes?: string[]
  }): Promise<ApiKeyItem> {
    return this.sendJson('POST', '/v1/management/keys', input, true)
  }

  async revokeKey(keyId: string): Promise<{ keyId: string; status: string }> {
    return this.sendJson('POST', `/v1/management/keys/${encodeURIComponent(keyId)}/revoke`, {}, true)
  }

  async rotateKey(keyId: string): Promise<ApiKeyItem> {
    return this.sendJson('POST', `/v1/management/keys/${encodeURIComponent(keyId)}/rotate`, {}, true)
  }

  async listCases(): Promise<{ items: FraudCaseItem[] }> {
    return this.sendJson('GET', '/v1/management/cases')
  }

  async openCase(input: { highRisk?: boolean; evidence?: string[] } = {}): Promise<FraudCaseItem> {
    return this.sendJson('POST', '/v1/management/cases', input, true)
  }

  async getRules(): Promise<RulesDocument> {
    return this.sendJson('GET', '/v1/management/rules')
  }

  async publishRules(input: RulePublishInput): Promise<RulesDocument> {
    return this.sendJson('POST', '/v1/management/rules', input, true)
  }

  async rollbackRules(): Promise<{ revision: string; rolledBack: boolean }> {
    return this.sendJson('POST', '/v1/management/rules/rollback', {}, true)
  }

  async simulateRules(facts: Record<string, unknown>): Promise<{
    effectiveAction: string
    simulated: boolean
    revision: string
  }> {
    return this.sendJson('POST', '/v1/management/rules/simulate', { facts }, true)
  }

  async listWebhooks(environmentId?: string): Promise<{ items: WebhookItem[] }> {
    const q = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : ''
    return this.sendJson('GET', `/v1/management/webhooks${q}`)
  }

  async createWebhook(input: {
    targetUrl: string
    environmentId?: string
    eventFilters?: string[]
  }): Promise<WebhookItem> {
    return this.sendJson('POST', '/v1/management/webhooks', input, true)
  }

  async rotateWebhook(subscriptionId: string): Promise<{ subscriptionId: string; secretOnce: string }> {
    return this.sendJson(
      'POST',
      `/v1/management/webhooks/${encodeURIComponent(subscriptionId)}/rotate`,
      {},
      true,
    )
  }

  async listWebhookDeliveries(): Promise<{ items: WebhookDeliveryItem[] }> {
    return this.sendJson('GET', '/v1/management/webhooks/deliveries')
  }

  async replayWebhookDelivery(deliveryId: string): Promise<{ deliveryId: string; status: string }> {
    return this.sendJson(
      'POST',
      `/v1/management/webhooks/deliveries/${encodeURIComponent(deliveryId)}/replay`,
      {},
      true,
    )
  }

  async listProjects(): Promise<{ items: ProjectItem[] }> {
    return this.sendJson('GET', '/v1/management/projects')
  }

  async createProject(name: string): Promise<ProjectItem> {
    return this.sendJson('POST', '/v1/management/projects', { name }, true)
  }

  async patchProject(
    projectId: string,
    input: { name?: string; retentionDays?: number; ifMatchRevision: number },
  ): Promise<ProjectItem> {
    return this.sendJson('PATCH', `/v1/management/projects/${encodeURIComponent(projectId)}`, input, true)
  }

  async listAudit(): Promise<{ items: AuditItem[] }> {
    return this.sendJson('GET', '/v1/management/audit')
  }

  async getUsage(projectId = 'default', environmentId = 'dev'): Promise<UsageSnapshot> {
    const q = `projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environmentId)}`
    return this.sendJson('GET', `/v1/management/usage?${q}`)
  }

  async getGraph(visitorId?: string): Promise<GraphSnapshot> {
    const q = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ''
    return this.sendJson('GET', `/v1/management/graph${q}`)
  }

  async addGraphEdge(input: {
    from: string
    to: string
    edgeType?: string
    confidence?: number
  }): Promise<{ edgeId: string; from: string; to: string; status: string }> {
    return this.sendJson('POST', '/v1/management/graph/edges', input, true)
  }

  async explainScore(input: Record<string, unknown> = {}): Promise<ScoreExplainResult> {
    return this.sendJson('POST', '/v1/management/score/explain', input, true)
  }

  async privacyExport(visitorId: string): Promise<PrivacyExportResult> {
    return this.sendJson('POST', `/v1/management/privacy/export/${encodeURIComponent(visitorId)}`, {}, true)
  }

  async privacyErase(visitorId: string, reason = 'dpo_erasure'): Promise<unknown> {
    return this.sendJson('POST', `/v1/management/privacy/erase/${encodeURIComponent(visitorId)}`, { reason }, true)
  }

  async listPrivacyTombstones(): Promise<{ items: unknown[] }> {
    return this.sendJson('GET', '/v1/management/privacy/tombstones')
  }

  async listPrivacyJobs(): Promise<{ items: unknown[] }> {
    return this.sendJson('GET', '/v1/management/privacy/jobs')
  }

  async enqueueWebhook(
    subscriptionId: string,
    eventType = 'event.identification',
  ): Promise<{ deliveryId: string; status: string }> {
    return this.sendJson(
      'POST',
      `/v1/management/webhooks/${encodeURIComponent(subscriptionId)}/enqueue`,
      { eventType },
      true,
    )
  }

  async processWebhooks(): Promise<{ processed: number; deadLetter: number }> {
    return this.sendJson('POST', '/v1/management/webhooks/process', {}, true)
  }

  async verifyBot(userAgent?: string, signedIdentity?: string): Promise<{
    classification: string
    status: string
    provider?: string | null
    evidence: readonly string[]
  }> {
    const q = new URLSearchParams()
    if (userAgent) q.set('userAgent', userAgent)
    if (signedIdentity) q.set('signedIdentity', signedIdentity)
    const suffix = q.toString() ? `?${q}` : ''
    return this.sendJson('GET', `/v1/management/bots/verify${suffix}`)
  }

  async enableVelocity(): Promise<{ enabled: boolean }> {
    return this.sendJson('POST', '/v1/management/velocity/enable', {}, true)
  }

  async recordVelocity(input: {
    accountHash?: string
    type?: string
    sharedTerminalId?: string
  }): Promise<{ ok: boolean; enabled: boolean }> {
    return this.sendJson('POST', '/v1/management/velocity/record', input, true)
  }

  async getVelocity(accountHash = 'acc_demo'): Promise<{
    enabled: boolean
    accountHash: string
    status: string
    loginFailures: number
    registrationRetries: number
    stepUpFailures: number
    burstNote?: string | null
  }> {
    return this.sendJson('GET', `/v1/management/velocity?accountHash=${encodeURIComponent(accountHash)}`)
  }

  async listSignalCatalog(): Promise<{
    items: readonly { signalId: string; channel: string; evaluable: boolean; deferralReason?: string | null }[]
  }> {
    return this.sendJson('GET', '/v1/management/signals/catalog')
  }

  async evaluateSignals(input: Record<string, unknown> = {}): Promise<{
    items: readonly {
      signalId: string
      status: string
      triState: string
      value?: string | null
      confidence?: number | null
      evidence: readonly string[]
    }[]
  }> {
    return this.sendJson('POST', '/v1/management/signals/evaluate', input, true)
  }

  private async sendJson<T>(
    method: string,
    path: string,
    body?: unknown,
    requireCsrf = false,
  ): Promise<T> {
    if (this.fetchImpl === undefined && typeof fetch === 'undefined') {
      throw new ProPlusDashboardClientError('fetch unavailable', 'network_unavailable')
    }
    if (requireCsrf && !this.csrfToken) {
      throw new ProPlusDashboardClientError('CSRF token required', 'csrf')
    }

    const fetchFn = this.fetchImpl ?? fetch
    const target = path.startsWith('http') ? path : new URL(path.replace(/^\//, ''), this.baseUrl).toString()
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-api-key-kind': 'secret',
      'x-api-scope': 'events:read',
      'x-actor-id': 'admin-console',
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`
    if (this.sessionId) {
      headers.authorization = `Bearer ${this.sessionId}`
      headers['x-console-session'] = this.sessionId
    }
    if (this.tenantId) headers['x-tenant-id'] = this.tenantId
    if (this.csrfToken) headers['x-csrf-token'] = this.csrfToken

    let response: Response
    try {
      const init: RequestInit = {
        method,
        headers,
        credentials: this.credentials,
        cache: 'no-store',
      }
      if (body !== undefined) init.body = JSON.stringify(body)
      response = await fetchFn(target, init)
    } catch {
      throw new ProPlusDashboardClientError('Network request failed', 'network_unavailable')
    }

    if (response.status === 401 || response.status === 403) {
      const code = response.status === 403 ? 'csrf' : 'unauthorized'
      throw new ProPlusDashboardClientError(`HTTP ${response.status}`, code)
    }
    if (!response.ok) {
      throw new ProPlusDashboardClientError(`HTTP ${response.status}`, 'http_error')
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}
