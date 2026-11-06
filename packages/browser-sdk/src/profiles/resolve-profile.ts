import { ENABLED_SOURCES, ENABLED_SOURCE_COUNT, type EnabledSourceName } from '@thenightwatch/core'
import { SOURCE_RELIABILITY_TIERS, tierAtMost } from './tiers.js'
import {
  RELIABILITY_PROFILES_REVISION,
  type ReliabilityProfileId,
  type ReliabilityProfileManifest,
  type ReliabilityProfileResolution,
  type ReliabilityTier,
} from './types.js'

const PROFILE_MAX_TIER: Record<ReliabilityProfileId, ReliabilityTier> = {
  conservative: 'stable',
  balanced: 'moderate',
  diagnostic: 'volatile',
}

export const RELIABILITY_PROFILE_IDS = [
  'conservative',
  'balanced',
  'diagnostic',
] as const satisfies readonly ReliabilityProfileId[]

export function isReliabilityProfileId(value: string): value is ReliabilityProfileId {
  return (RELIABILITY_PROFILE_IDS as readonly string[]).includes(value)
}

export function assertReliabilityProfileId(profileId: string): ReliabilityProfileId {
  if (!isReliabilityProfileId(profileId)) {
    throw new TypeError(
      `Unknown reliability profile "${profileId}". Expected one of: ${RELIABILITY_PROFILE_IDS.join(', ')}`,
    )
  }
  return profileId
}

/**
 * Builds a diffable, versioned manifest for a profile.
 * Inclusion order matches {@link ENABLED_SOURCES}.
 */
export function getReliabilityProfileManifest(
  profileId: ReliabilityProfileId,
): ReliabilityProfileManifest {
  const maxTier = PROFILE_MAX_TIER[profileId]
  const includedSources: EnabledSourceName[] = []
  const excludedSources: EnabledSourceName[] = []

  for (const source of ENABLED_SOURCES) {
    const tier = SOURCE_RELIABILITY_TIERS[source]
    if (tierAtMost(tier, maxTier)) {
      includedSources.push(source)
    } else {
      excludedSources.push(source)
    }
  }

  const notes: string[] = [
    `Profile catalog ${RELIABILITY_PROFILES_REVISION}; default-profile source set remains 41 (no applePay).`,
    'Opt-in only — default load() uses the full reference set without a profile label.',
    'Tiers are operational heuristics, not calibrated stability rates or identity proof.',
  ]
  if (profileId === 'conservative') {
    notes.push('Includes stable-tier sources only; expects lower volatility and less entropy.')
  } else if (profileId === 'balanced') {
    notes.push('Includes stable + moderate tiers; omits volatile selectors.')
  } else {
    notes.push(
      'Diagnostic includes all 41 sources (same selectors as default load); use for labeled debugging.',
    )
  }

  return {
    revision: RELIABILITY_PROFILES_REVISION,
    profileId,
    includedSources,
    excludedSources,
    includedCount: includedSources.length,
    excludedCount: excludedSources.length,
    notes,
  }
}

export function resolveReliabilityProfile(
  profileId: ReliabilityProfileId,
): ReliabilityProfileResolution {
  const manifest = getReliabilityProfileManifest(profileId)
  return {
    manifest,
    visitorIdWillDifferFromFullDefault: manifest.excludedCount > 0,
  }
}

/** Stable JSON form for manifest diffs / snapshots in tests and ops. */
export function reliabilityProfileManifestToJson(
  manifest: ReliabilityProfileManifest,
): string {
  return `${JSON.stringify(
    {
      revision: manifest.revision,
      profileId: manifest.profileId,
      includedSources: [...manifest.includedSources],
      excludedSources: [...manifest.excludedSources],
      includedCount: manifest.includedCount,
      excludedCount: manifest.excludedCount,
    },
    null,
    2,
  )}\n`
}

export function listAllReliabilityProfileManifests(): ReliabilityProfileManifest[] {
  return RELIABILITY_PROFILE_IDS.map((id) => getReliabilityProfileManifest(id))
}

export function assertProfileMath(): void {
  for (const id of RELIABILITY_PROFILE_IDS) {
    const m = getReliabilityProfileManifest(id)
    if (m.includedCount + m.excludedCount !== ENABLED_SOURCE_COUNT) {
      throw new Error(`Profile ${id} inclusion math broken`)
    }
    if (m.includedSources.includes('applePay' as EnabledSourceName)) {
      throw new Error(`Profile ${id} leaked applePay`)
    }
  }
  const diagnostic = getReliabilityProfileManifest('diagnostic')
  if (diagnostic.excludedCount !== 0 || diagnostic.includedCount !== 41) {
    throw new Error('diagnostic profile must include all 41 sources')
  }
}
