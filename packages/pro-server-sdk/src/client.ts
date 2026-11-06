import {
  IDENTITY_ALGORITHM_VERSION,
  PROCESSING_VERSION,
  type ObservationEnvelope,
  type ServerVisitorIdentity,
  unknownEvidence,
} from '@thenightwatch/contracts'

export type ServerSdkConfig = {
  /** First-party absolute origin only (https://fp.example.ir). No vendor SaaS hosts. */
  readonly baseUrl: string
  readonly publicApiKey?: string
  readonly fetchImpl?: typeof fetch
}

export type IdentifyResponse = {
  readonly eventId: string
  readonly status: 'accepted' | 'pending' | 'rejected'
  readonly serverVisitor: ServerVisitorIdentity
  readonly processingVersion: typeof PROCESSING_VERSION
  readonly serverTime: string
}

export class ProPlusServerSdkError extends Error {
  override readonly name = 'ProPlusServerSdkError'
  constructor(
    message: string,
    readonly code:
      | 'not_configured'
      | 'invalid_base_url'
      | 'network_unavailable'
      | 'http_error'
      | 'unsupported',
  ) {
    super(message)
  }
}

function assertFirstPartyBaseUrl(baseUrl: string): URL {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new ProPlusServerSdkError('baseUrl must be an absolute URL', 'invalid_base_url')
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new ProPlusServerSdkError(
      'baseUrl must use https (localhost http allowed for lab only)',
      'invalid_base_url',
    )
  }
  const host = url.hostname.toLowerCase()
  if (host.includes('fingerprint.com') || host.includes('fpjs.io') || host.includes('openfpcdn')) {
    throw new ProPlusServerSdkError(
      'Vendor Fingerprint hosts are forbidden; use a first-party origin',
      'invalid_base_url',
    )
  }
  return url
}

/**
 * Typed client skeleton for `/v1` first-party APIs.
 * Network calls are opt-in; until the ASP.NET backend exists, identify() stays unavailable.
 */
export class ProPlusServerSdk {
  private readonly baseUrl: URL
  private readonly publicApiKey: string | undefined
  private readonly fetchImpl: typeof fetch | undefined

  constructor(config: ServerSdkConfig) {
    this.baseUrl = assertFirstPartyBaseUrl(config.baseUrl)
    this.publicApiKey = config.publicApiKey
    this.fetchImpl = config.fetchImpl
  }

  /**
   * Posts an observation envelope to first-party identify.
   * Returns `unavailable` semantics via thrown {@link ProPlusServerSdkError} when fetch is missing
   * or the backend is not yet deployed.
   */
  async identify(observation: ObservationEnvelope): Promise<IdentifyResponse> {
    if (observation.identityAlgorithmVersion !== IDENTITY_ALGORITHM_VERSION) {
      throw new ProPlusServerSdkError(
        `Unsupported identityAlgorithmVersion: ${observation.identityAlgorithmVersion}`,
        'unsupported',
      )
    }
    if (this.fetchImpl === undefined && typeof fetch === 'undefined') {
      throw new ProPlusServerSdkError(
        'fetch is unavailable in this runtime',
        'network_unavailable',
      )
    }
    const fetchFn = this.fetchImpl ?? fetch
    const target = new URL('/v1/identify', this.baseUrl)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    }
    if (this.publicApiKey !== undefined) {
      headers['authorization'] = `Bearer ${this.publicApiKey}`
    }
    let response: Response
    try {
      response = await fetchFn(target, {
        method: 'POST',
        headers,
        body: JSON.stringify(observation),
      })
    } catch {
      throw new ProPlusServerSdkError('Network request failed', 'network_unavailable')
    }
    if (!response.ok) {
      throw new ProPlusServerSdkError(`HTTP ${response.status}`, 'http_error')
    }
    return (await response.json()) as IdentifyResponse
  }
}

/** Placeholder server identity used in offline unit tests (not a production assignment). */
export function placeholderUnknownServerVisitor(visitorId = 'v_unassigned'): ServerVisitorIdentity {
  return {
    visitorId,
    identityAlgorithmVersion: IDENTITY_ALGORITHM_VERSION,
    matchType: 'unknown',
    identityConfidence: unknownEvidence('server', 'backend_not_bootstrapped'),
    firstSeenAt: null,
    lastSeenAt: null,
  }
}
