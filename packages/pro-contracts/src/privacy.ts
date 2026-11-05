export type LawfulPurposeId = string

export type CollectionMode = 'off' | 'browser_only' | 'pro_plus'

export type PrivacyPolicyDocument = {
  readonly revision: 'night-watch-privacy-v0'
  readonly requirePurposeOnIngest: boolean
  readonly defaultRetentionDays: number
  readonly suppressedByDefault: readonly string[]
  readonly forbiddenCapabilities: readonly string[]
  readonly telemetryDefault: 'off'
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicyDocument = {
  revision: 'night-watch-privacy-v0',
  requirePurposeOnIngest: true,
  defaultRetentionDays: 90,
  suppressedByDefault: [
    'pageUrl',
    'pageTitle',
    'cookies',
    'geolocation',
    'microphone',
    'contacts',
    'advertisingId',
    'crossOriginBeacons',
  ],
  forbiddenCapabilities: ['applePay', 'nativeAttestation', 'vendorFingerprintSaas'],
  telemetryDefault: 'off',
}

export function assertPurposeAllowed(
  purpose: string | undefined,
  configuredPurposes: readonly string[],
  requirePurpose: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!requirePurpose) return { ok: true }
  if (!purpose || purpose.trim().length === 0) {
    return { ok: false, reason: 'purpose_required' }
  }
  if (configuredPurposes.length > 0 && !configuredPurposes.includes(purpose)) {
    return { ok: false, reason: 'purpose_not_configured' }
  }
  return { ok: true }
}
