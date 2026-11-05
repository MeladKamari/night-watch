export type ContractValidationIssue = {
  readonly path: string
  readonly message: string
}

export type ContractValidationResult =
  | { ok: true }
  | { ok: false; issues: ContractValidationIssue[] }

const MAX_JSON_BYTES = 256 * 1024

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function issue(path: string, message: string): ContractValidationIssue {
  return { path, message }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rejectUnexpected(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: ContractValidationIssue[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      issues.push(issue(`${path}.${key}`, 'unexpected field'))
    }
  }
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: ContractValidationIssue[],
  opts?: { const?: string; pattern?: RegExp; max?: number; min?: number },
): string | undefined {
  const value = obj[key]
  if (typeof value !== 'string') {
    issues.push(issue(`${path}.${key}`, 'must be string'))
    return undefined
  }
  if (opts?.const !== undefined && value !== opts.const) {
    issues.push(issue(`${path}.${key}`, `must equal ${opts.const}`))
  }
  if (opts?.pattern && !opts.pattern.test(value)) {
    issues.push(issue(`${path}.${key}`, 'pattern mismatch'))
  }
  if (opts?.max !== undefined && value.length > opts.max) {
    issues.push(issue(`${path}.${key}`, 'too long'))
  }
  if (opts?.min !== undefined && value.length < opts.min) {
    issues.push(issue(`${path}.${key}`, 'too short'))
  }
  return value
}

function requireRfc3339(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: ContractValidationIssue[],
  allowNull = false,
): void {
  const value = obj[key]
  if (value === null && allowNull) return
  if (typeof value !== 'string' || !RFC3339.test(value)) {
    issues.push(issue(`${path}.${key}`, 'must be RFC3339 / UTC timestamp'))
  }
}

export function assertPayloadSize(raw: string | Uint8Array): ContractValidationResult {
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength
  if (bytes > MAX_JSON_BYTES) {
    return { ok: false, issues: [issue('$', `payload exceeds ${MAX_JSON_BYTES} bytes`)] }
  }
  return { ok: true }
}

export function validateObservation(input: unknown): ContractValidationResult {
  const issues: ContractValidationIssue[] = []
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('$', 'must be object')] }
  }
  rejectUnexpected(
    input,
    [
      'schemaVersion',
      'productCode',
      'processingVersion',
      'identityAlgorithmVersion',
      'purpose',
      'consentStatus',
      'collectedAt',
      'idempotencyKey',
      'nonce',
      'region',
      'tenantHint',
      'projectHint',
      'legacyBrowser',
    ],
    '$',
    issues,
  )
  requireString(input, 'schemaVersion', '$', issues, { const: 'night-watch-observation-v1' })
  requireString(input, 'productCode', '$', issues, { const: 'night-watch' })
  requireString(input, 'processingVersion', '$', issues, { min: 1, max: 64 })
  requireString(input, 'identityAlgorithmVersion', '$', issues, { min: 1, max: 64 })
  requireString(input, 'purpose', '$', issues, { min: 1, max: 128 })
  const consent = requireString(input, 'consentStatus', '$', issues)
  if (
    consent !== undefined &&
    !['granted', 'denied', 'unknown', 'not_required'].includes(consent)
  ) {
    issues.push(issue('$.consentStatus', 'invalid enum'))
  }
  requireRfc3339(input, 'collectedAt', '$', issues)
  requireString(input, 'idempotencyKey', '$', issues, { min: 8, max: 128 })

  const legacy = input.legacyBrowser
  if (!isPlainObject(legacy)) {
    issues.push(issue('$.legacyBrowser', 'must be object'))
  } else {
    rejectUnexpected(
      legacy,
      [
        'visitorId',
        'sourceManifestRevision',
        'hashingRevision',
        'confidenceScore',
        'confidenceComment',
        'componentKeys',
        'sdkPackageVersion',
      ],
      '$.legacyBrowser',
      issues,
    )
    requireString(legacy, 'visitorId', '$.legacyBrowser', issues, {
      pattern: /^[0-9a-f]{32}$/,
    })
    requireString(legacy, 'sourceManifestRevision', '$.legacyBrowser', issues, {
      const: 'default-v1',
    })
    const keys = legacy.componentKeys
    if (!Array.isArray(keys)) {
      issues.push(issue('$.legacyBrowser.componentKeys', 'must be array'))
    } else if (keys.length > 64) {
      issues.push(issue('$.legacyBrowser.componentKeys', 'oversized array'))
    } else if (keys.some((k) => k === 'applePay')) {
      issues.push(issue('$.legacyBrowser.componentKeys', 'applePay forbidden'))
    } else if (keys.some((k) => typeof k !== 'string')) {
      issues.push(issue('$.legacyBrowser.componentKeys', 'malformed array items'))
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export function validateIdentificationEvent(input: unknown): ContractValidationResult {
  const issues: ContractValidationIssue[] = []
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('$', 'must be object')] }
  }
  requireString(input, 'schemaVersion', '$', issues, { const: 'night-watch-event-v1' })
  requireString(input, 'eventId', '$', issues, { pattern: /^ev_[A-Za-z0-9]{8,64}$/ })
  requireString(input, 'visitorId', '$', issues, { pattern: /^v_[A-Za-z0-9]{8,64}$/ })
  const matchType = requireString(input, 'matchType', '$', issues)
  if (
    matchType !== undefined &&
    !['exact', 'probable', 'ambiguous', 'new', 'unknown', 'unsupported'].includes(matchType)
  ) {
    issues.push(issue('$.matchType', 'invalid enum'))
  }
  const outcome = requireString(input, 'identityOutcome', '$', issues)
  if (
    outcome !== undefined &&
    !['new', 'matched', 'ambiguous', 'unsupported'].includes(outcome)
  ) {
    issues.push(issue('$.identityOutcome', 'invalid enum'))
  }
  requireRfc3339(input, 'firstSeenAt', '$', issues, true)
  requireRfc3339(input, 'lastSeenAt', '$', issues, true)
  requireRfc3339(input, 'serverTime', '$', issues)
  requireString(input, 'processingVersion', '$', issues, { min: 1 })
  requireString(input, 'region', '$', issues, { min: 1, max: 32 })

  if (!isPlainObject(input.signals)) {
    issues.push(issue('$.signals', 'must be object'))
  } else if (Object.keys(input.signals).length > 64) {
    issues.push(issue('$.signals', 'too many properties'))
  }

  if (!isPlainObject(input.risk)) {
    issues.push(issue('$.risk', 'must be object'))
  } else if (input.risk.status === 'unknown' && input.risk.score === false) {
    issues.push(issue('$.risk.score', 'unknown must not be serialized as false'))
  }

  if ('extraEvil' in input) {
    issues.push(issue('$.extraEvil', 'unexpected field'))
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export function validateErrorEnvelope(input: unknown): ContractValidationResult {
  const issues: ContractValidationIssue[] = []
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('$', 'must be object')] }
  }
  rejectUnexpected(input, ['type', 'title', 'status', 'code', 'detail', 'instance'], '$', issues)
  requireString(input, 'type', '$', issues, { min: 1 })
  requireString(input, 'title', '$', issues, { min: 1, max: 128 })
  requireString(input, 'code', '$', issues, { min: 1, max: 64 })
  if (typeof input.status !== 'number' || input.status < 400 || input.status > 599) {
    issues.push(issue('$.status', 'must be HTTP error status'))
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export const CONTRACT_SCHEMA_VERSIONS = {
  observation: 'night-watch-observation-v1',
  event: 'night-watch-event-v1',
  maxPayloadBytes: MAX_JSON_BYTES,
} as const
