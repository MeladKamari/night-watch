/** Optional Pro+ API lab calls from the playground (loopback only). */

export type ProPlusLabConfig = {
  apiBase: string
  tenantId: string
  projectId: string
}

export type IdentifyLabResult = {
  visitorId: string
  eventId: string
  matchType: string
  confidenceStatus: string
  receipt: string
  sealedEnvelope?: string
  sealedAudience?: string
  raw: unknown
}

export type DecisionLabResult = {
  action: string
  score?: number
  usedScore?: number
  reasons: unknown
  scoreReceipt: unknown
  raw: unknown
}

const DEFAULT_CONFIG: ProPlusLabConfig = {
  apiBase: 'http://127.0.0.1:5080',
  tenantId: 'tenant_demo',
  projectId: 'prj_playground',
}

export function readLabConfig(): ProPlusLabConfig {
  const g = globalThis as {
    NIGHT_WATCH_API_BASE?: string
    NIGHT_WATCH_TENANT_ID?: string
    NIGHT_WATCH_PROJECT_ID?: string
  }
  return {
    apiBase: (g.NIGHT_WATCH_API_BASE ?? DEFAULT_CONFIG.apiBase).replace(/\/$/, ''),
    tenantId: g.NIGHT_WATCH_TENANT_ID ?? DEFAULT_CONFIG.tenantId,
    projectId: g.NIGHT_WATCH_PROJECT_ID ?? DEFAULT_CONFIG.projectId,
  }
}

export async function pingApi(apiBase = readLabConfig().apiBase): Promise<{ ok: boolean; body: string }> {
  try {
    const res = await fetch(`${apiBase}/health/live`)
    const body = await res.text()
    return { ok: res.ok, body }
  } catch (err) {
    return { ok: false, body: err instanceof Error ? err.message : String(err) }
  }
}

export type ClientDevicePayload = {
  platform?: string
  osFamily?: string
  browserFamily?: string
  locale?: string
  screenWidth?: number
  screenHeight?: number
  webGlRenderer?: string
}

const CONTINUITY_STORAGE_KEY = 'night_watch_continuity_token'

export function readStoredContinuityToken(): string | undefined {
  try {
    const v = globalThis.localStorage?.getItem(CONTINUITY_STORAGE_KEY)
    return v && v.length > 0 ? v : undefined
  } catch {
    return undefined
  }
}

export function storeContinuityToken(token: string | undefined | null): void {
  if (!token) return
  try {
    globalThis.localStorage?.setItem(CONTINUITY_STORAGE_KEY, token)
  } catch {
    /* ignore quota / private mode */
  }
}

export type IdentifyComponentMap = Record<
  string,
  { value?: unknown; error?: unknown; duration: number }
>

export async function issueIdentifyChallenge(
  config?: ProPlusLabConfig,
): Promise<string> {
  const cfg = config ?? readLabConfig()
  const res = await fetch(`${cfg.apiBase}/v1/identify/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: cfg.tenantId, projectId: cfg.projectId }),
  })
  const raw = await res.json()
  if (!res.ok) {
    throw new Error(`challenge ${res.status}: ${JSON.stringify(raw)}`)
  }
  const nonce = raw?.challengeNonce ?? raw?.ChallengeNonce
  if (typeof nonce !== 'string' || nonce.length < 16) {
    throw new Error('challenge response missing challengeNonce')
  }
  return nonce
}

export async function identifyToProPlus(input: {
  legacyVisitorId: string
  componentKeys: string[]
  components: IdentifyComponentMap
  sourceManifestRevision: string
  clientDevice?: ClientDevicePayload
  environmentProbes?: EnvironmentProbesPayload
  continuityToken?: string
  config?: ProPlusLabConfig
}): Promise<IdentifyLabResult> {
  const cfg = input.config ?? readLabConfig()
  const idem = `pg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  const continuityToken = input.continuityToken ?? readStoredContinuityToken()
  const challengeNonce = await issueIdentifyChallenge(cfg)
  const body = {
    schemaVersion: 'night-watch-identify-v1',
    productCode: 'night-watch',
    purpose: 'fraud_prevention',
    consentStatus: 'granted',
    collectedAt: new Date().toISOString(),
    idempotencyKey: idem,
    tenantId: cfg.tenantId,
    projectId: cfg.projectId,
    region: 'ir-central',
    challengeNonce,
    clientVisitorId: 'ignored_client_authority',
    clientConfidence: 0.5,
    clientDevice: input.clientDevice,
    environmentProbes: input.environmentProbes,
    continuityToken,
    continuityLegalBasis: 'legitimate_interest',
    legacyBrowser: {
      visitorId: input.legacyVisitorId,
      sourceManifestRevision: input.sourceManifestRevision,
      hashingRevision: 'murmur3-x64-128-canonical-v1',
      componentKeys: input.componentKeys,
      components: input.components,
    },
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idem,
    'X-Tenant-Id': cfg.tenantId,
    'X-Seal-Audience': 'playground-lab',
    'X-Correlation-Id': idem,
  }
  if (continuityToken) {
    headers['X-Continuity-Token'] = continuityToken
  }

  const res = await fetch(`${cfg.apiBase}/v1/identify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const raw = await res.json()
  if (!res.ok) {
    throw new Error(`identify ${res.status}: ${JSON.stringify(raw)}`)
  }
  const nextToken =
    raw?.continuity?.token ?? raw?.Continuity?.Token ?? raw?.continuity?.Token
  storeContinuityToken(typeof nextToken === 'string' ? nextToken : undefined)
  return {
    visitorId: String(raw.visitorId ?? raw.VisitorId ?? ''),
    eventId: String(raw.eventId ?? raw.EventId ?? ''),
    matchType: String(raw.matchType ?? raw.MatchType ?? ''),
    confidenceStatus: String(raw.confidenceStatus ?? raw.ConfidenceStatus ?? ''),
    receipt: String(raw.receipt ?? raw.Receipt ?? ''),
    sealedEnvelope: raw.sealedEnvelope ?? raw.SealedEnvelope,
    sealedAudience: raw.sealedAudience ?? raw.SealedAudience,
    raw,
  }
}

export type EnvironmentProbesPayload = {
  probeCollected: true
  userAgent: string
  navigatorWebdriver: boolean | null
  headlessUa: boolean
  cdpSideEffect?: boolean
  chromeRuntimeMissing?: boolean | null
  pluginCount?: number | null
  clientHintBrands?: string[]
  automationArtifacts: string[]
  platform?: string
  deviceMemory?: number
  hardwareConcurrency?: number
  maxTouchPoints?: number
  colorDepth?: number
  webGlVendor?: string
  webGlRenderer?: string
  incognitoSuspected?: boolean
  vmSuspected?: boolean
}

export async function evaluateDecision(input: {
  eventId: string
  businessAction?: string
  environmentProbes: EnvironmentProbesPayload
  config?: ProPlusLabConfig
}): Promise<DecisionLabResult> {
  const cfg = input.config ?? readLabConfig()
  const body = {
    tenantId: cfg.tenantId,
    businessAction: input.businessAction ?? 'checkout',
    eventId: input.eventId,
    nonce: `n_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    suspectScore: 0,
    userAgent: input.environmentProbes.userAgent,
    environmentProbes: input.environmentProbes,
  }

  const res = await fetch(`${cfg.apiBase}/v1/decisions/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': cfg.tenantId,
    },
    body: JSON.stringify(body),
  })
  const raw = await res.json()
  if (!res.ok) {
    throw new Error(`decisions ${res.status}: ${JSON.stringify(raw)}`)
  }
  const receipt = raw.scoreReceipt ?? {}
  return {
    action: String(raw.action ?? ''),
    score: typeof receipt.score === 'number' ? receipt.score : undefined,
    usedScore: typeof receipt.usedScore === 'number' ? receipt.usedScore : undefined,
    reasons: raw.reasons,
    scoreReceipt: receipt,
    raw,
  }
}
