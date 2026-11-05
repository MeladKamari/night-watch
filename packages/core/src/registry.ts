/**
 * Locked Default-profile source registry for algorithm revision `default-v1`.
 *
 * Behavioral baseline: FingerprintJS OSS v5.3.0
 * Pinned commit: dac5ae59409669f09aa09c0b2f44b7615b0520da
 *
 * Browser globals are never read here. Safe to import under Node / SSR.
 */

/** Upstream registry key intentionally omitted from this product. */
export const EXCLUDED_UPSTREAM_SOURCE = 'applePay' as const

/** Source-set / algorithm manifest revision. Changing enabled sources requires a new revision. */
export const SOURCE_MANIFEST_REVISION = 'default-v1' as const

/** Pinned upstream package identity (reference only; not our publish name). */
export const UPSTREAM_PIN = {
  repository: 'fingerprintjs/fingerprintjs',
  tag: 'v5.3.0',
  commit: 'dac5ae59409669f09aa09c0b2f44b7615b0520da',
  packageName: '@fingerprintjs/fingerprintjs',
  packageVersion: '5.3.0',
  license: 'MIT',
} as const

/**
 * Enabled entropy source keys in exact collection / registration order.
 * Relative upstream order is preserved after deleting `applePay`.
 */
export const ENABLED_SOURCES = [
  'userAgentData',
  'fonts',
  'domBlockers',
  'fontPreferences',
  'audio',
  'screenFrame',
  'canvas',
  'osCpu',
  'languages',
  'colorDepth',
  'deviceMemory',
  'screenResolution',
  'hardwareConcurrency',
  'timezone',
  'sessionStorage',
  'localStorage',
  'indexedDB',
  'openDatabase',
  'cpuClass',
  'platform',
  'plugins',
  'touchSupport',
  'vendor',
  'vendorFlavors',
  'cookiesEnabled',
  'colorGamut',
  'invertedColors',
  'forcedColors',
  'monochrome',
  'contrast',
  'reducedMotion',
  'reducedTransparency',
  'hdr',
  'math',
  'pdfViewerEnabled',
  'architecture',
  'privateClickMeasurement',
  'audioBaseLatency',
  'dateTimeLocale',
  'webGlBasics',
  'webGlExtensions',
] as const

export type EnabledSourceName = (typeof ENABLED_SOURCES)[number]

export const ENABLED_SOURCE_COUNT: number = ENABLED_SOURCES.length

export const UPSTREAM_SOURCE_COUNT = 42 as const

export class RegistryInvariantError extends Error {
  override readonly name = 'RegistryInvariantError'
}

/**
 * Validates Default-profile registry invariants.
 * Throws {@link RegistryInvariantError} when the source list is invalid.
 */
export function assertDefaultRegistryInvariants(
  sources: readonly string[] = ENABLED_SOURCES,
): void {
  if (sources.length !== 41) {
    throw new RegistryInvariantError(`Expected 41 enabled sources, got ${sources.length}`)
  }
  if (sources.includes(EXCLUDED_UPSTREAM_SOURCE)) {
    throw new RegistryInvariantError(
      `Excluded source "${EXCLUDED_UPSTREAM_SOURCE}" must not be registered`,
    )
  }
  const unique = new Set(sources)
  if (unique.size !== sources.length) {
    throw new RegistryInvariantError('Enabled source names must be unique')
  }
}

/** Returns a mutable copy of the enabled source list (never the live const array). */
export function listEnabledSources(): EnabledSourceName[] {
  return [...ENABLED_SOURCES]
}

export function isExcludedUpstreamSource(name: string): boolean {
  return name === EXCLUDED_UPSTREAM_SOURCE
}
