/**
 * Night Watch product identity (single product — browser + server).
 * Not affiliated with Fingerprint Inc. or FingerprintJS.
 */
export const PRODUCT_NAME = 'Night Watch' as const
export const PRODUCT_CODE = 'night-watch' as const
export const NPM_SCOPE = '@night-watch' as const

/** Human-safe label for dashboards and docs (never "Fingerprint Pro"). */
export const PRODUCT_PUBLIC_LABEL = 'Night Watch' as const

/**
 * Opaque server identity algorithm revision.
 * Independent of legacy browser `SOURCE_MANIFEST_REVISION`.
 */
export const IDENTITY_ALGORITHM_VERSION = 'night-watch-identity-v0' as const

/** Risk / signal evaluation processing envelope revision. */
export const PROCESSING_VERSION = 'night-watch-processing-v0' as const

export const CONTRACTS_PACKAGE_NAME = '@night-watch/contracts' as const
export const CONTRACTS_PACKAGE_VERSION = '1.0.0' as const
