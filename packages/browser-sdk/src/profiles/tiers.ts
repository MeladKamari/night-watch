import { ENABLED_SOURCES, type EnabledSourceName } from '@thenightwatch/core'
import type { ReliabilityTier, SourceReliabilityRow } from './types.js'

/**
 * Per-source reliability tags for profile selection.
 * Heuristic / operational — not a calibrated stability rate or identity proof.
 * Never includes `applePay`.
 */
export const SOURCE_RELIABILITY_TIERS: Readonly<
  Record<EnabledSourceName, ReliabilityTier>
> = {
  // Stable: low environmental churn for typical desktop sessions
  osCpu: 'stable',
  colorDepth: 'stable',
  hardwareConcurrency: 'stable',
  sessionStorage: 'stable',
  localStorage: 'stable',
  indexedDB: 'stable',
  openDatabase: 'stable',
  cpuClass: 'stable',
  platform: 'stable',
  vendor: 'stable',
  cookiesEnabled: 'stable',
  math: 'stable',
  pdfViewerEnabled: 'stable',
  architecture: 'stable',

  // Moderate: can change with locale, display prefs, UA-CH, plugins
  userAgentData: 'moderate',
  languages: 'moderate',
  deviceMemory: 'moderate',
  screenResolution: 'moderate',
  timezone: 'moderate',
  plugins: 'moderate',
  touchSupport: 'moderate',
  vendorFlavors: 'moderate',
  colorGamut: 'moderate',
  invertedColors: 'moderate',
  forcedColors: 'moderate',
  monochrome: 'moderate',
  contrast: 'moderate',
  reducedMotion: 'moderate',
  reducedTransparency: 'moderate',
  hdr: 'moderate',
  dateTimeLocale: 'moderate',

  // Volatile: anti-fp noise, GPU/driver, fonts, audio, chrome insets, blockers
  fonts: 'volatile',
  domBlockers: 'volatile',
  fontPreferences: 'volatile',
  audio: 'volatile',
  screenFrame: 'volatile',
  canvas: 'volatile',
  privateClickMeasurement: 'volatile',
  audioBaseLatency: 'volatile',
  webGlBasics: 'volatile',
  webGlExtensions: 'volatile',
}

const TIER_RANK: Record<ReliabilityTier, number> = {
  stable: 0,
  moderate: 1,
  volatile: 2,
}

/** Returns true when `tier` is at most as volatile as `maxTier`. */
export function tierAtMost(tier: ReliabilityTier, maxTier: ReliabilityTier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[maxTier]
}

export function listReliabilityRows(): SourceReliabilityRow[] {
  return ENABLED_SOURCES.map((source) => ({
    source,
    tier: SOURCE_RELIABILITY_TIERS[source],
  }))
}

/** Module invariant: every enabled source has exactly one tier; no applePay. */
export function assertReliabilityTierCoverage(): void {
  for (const source of ENABLED_SOURCES) {
    if (!(source in SOURCE_RELIABILITY_TIERS)) {
      throw new Error(`Missing reliability tier for ${source}`)
    }
  }
  const keys = Object.keys(SOURCE_RELIABILITY_TIERS)
  if (keys.length !== ENABLED_SOURCES.length) {
    throw new Error(
      `Reliability tier map size ${keys.length} !== ENABLED_SOURCES ${ENABLED_SOURCES.length}`,
    )
  }
  if (keys.includes('applePay')) {
    throw new Error('applePay must not appear in reliability tiers')
  }
}
