/**
 * Design-only contracts for a **future** first-party server integration.
 * Step 71 — no runtime network client is shipped. The browser SDK remains
 * fully functional offline without these types.
 */

export const SERVER_INTEGRATION_DESIGN_REVISION = 'night-watch-server-design-v1' as const

export type ServerIntegrationDesignRevision = typeof SERVER_INTEGRATION_DESIGN_REVISION

/** Deployer-owned retention policy — never hardcoded to a third-party cloud. */
export type RetentionPolicyDesign = {
  readonly maxAgeDays: number
  readonly deleteOnUserRequest: true
  /** Regional hosting choice owned by the deployer (e.g. self-hosted IR DC). */
  readonly hostingRegionNote: string
}

export type EvidenceAuthDesign = {
  /** App-issued bearer / mTLS — never vendor SaaS keys baked into the SDK. */
  readonly mechanism: 'first-party-bearer' | 'mtls' | 'signed-request'
  readonly rotateAtLeastDays: number
}

export type RateLimitDesign = {
  readonly perIpPerMinute: number
  readonly perSubjectPerMinute: number
}

export type EncryptionDesign = {
  readonly inTransit: 'tls1.2+'
  /** At-rest encryption is deployer-controlled (KMS / disk). */
  readonly atRest: 'deployer-managed'
}

/**
 * Optional future evidence payload shape (design).
 * Must not be posted by `@night-watch/browser-sdk` unless a separately versioned
 * package is explicitly adopted later.
 */
export type ConsentedEvidencePayloadDesign = {
  readonly schema: 'night-watch-evidence-v1'
  readonly visitorId: string
  readonly sourceManifestRevision: string
  readonly consentNoticeVersion: string
  readonly collectedAt: string
  /** Redacted / minimized components — never raw cookies or page URLs. */
  readonly componentsMinimized: true
}

export type UserDeletionRequestDesign = {
  readonly subjectKey: string
  readonly requestedAt: string
}

export type FirstPartyServerIntegrationDesign = {
  readonly revision: ServerIntegrationDesignRevision
  readonly browserPackageRemainsStandalone: true
  readonly thirdPartyCloudHardcodingForbidden: true
  readonly auth: EvidenceAuthDesign
  readonly retention: RetentionPolicyDesign
  readonly rateLimit: RateLimitDesign
  readonly encryption: EncryptionDesign
  readonly evidenceSchema: 'night-watch-evidence-v1'
  readonly deletion: {
    readonly endpointConcept: 'DELETE /v1/subjects/{subjectKey}'
    readonly slaNote: 'Deployer-defined; design requires acknowledgment + purge receipt'
  }
  readonly notes: readonly string[]
}

/** Frozen design snapshot for docs/tests — not a runnable client. */
export const FIRST_PARTY_SERVER_INTEGRATION_DESIGN: FirstPartyServerIntegrationDesign = {
  revision: SERVER_INTEGRATION_DESIGN_REVISION,
  browserPackageRemainsStandalone: true,
  thirdPartyCloudHardcodingForbidden: true,
  auth: {
    mechanism: 'first-party-bearer',
    rotateAtLeastDays: 90,
  },
  retention: {
    maxAgeDays: 90,
    deleteOnUserRequest: true,
    hostingRegionNote: 'Deployer chooses region / on-prem; SDK ships no cloud endpoint',
  },
  rateLimit: {
    perIpPerMinute: 60,
    perSubjectPerMinute: 20,
  },
  encryption: {
    inTransit: 'tls1.2+',
    atRest: 'deployer-managed',
  },
  evidenceSchema: 'night-watch-evidence-v1',
  deletion: {
    endpointConcept: 'DELETE /v1/subjects/{subjectKey}',
    slaNote: 'Deployer-defined; design requires acknowledgment + purge receipt',
  },
  notes: [
    'Design-only (step 71). No fetch/XHR/WebSocket client is registered in @night-watch/browser-sdk.',
    'Optional local ingestion must be first-party only.',
    'Default load() never contacts a server.',
  ],
}
