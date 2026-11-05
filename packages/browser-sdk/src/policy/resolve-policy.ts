import { ENABLED_SOURCES, ENABLED_SOURCE_COUNT } from '@night-watch/core'
import {
  SOURCE_CATEGORIES,
  sourcesInCategories,
  type SourceCategory,
} from './categories.js'
import type { CollectionPolicy, PolicyResolution } from './types.js'

function uniquePreserveOrder(keys: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/**
 * Resolves which Default-profile sources to exclude for an opt-in policy.
 * Never adds `applePay` (already absent). Does not mutate ENABLED_SOURCES.
 */
export function resolveExcludedSources(policy: CollectionPolicy): string[] {
  const omitFromCategories = sourcesInCategories(policy.omitCategories ?? [])
  const explicitOmit = [...(policy.omitSources ?? [])]

  let allowSet: Set<string> | undefined
  if (policy.allowCategories !== undefined) {
    allowSet = new Set(sourcesInCategories(policy.allowCategories))
  }

  const excluded: string[] = []
  for (const name of ENABLED_SOURCES) {
    if (omitFromCategories.includes(name) || explicitOmit.includes(name)) {
      excluded.push(name)
      continue
    }
    if (allowSet && !allowSet.has(name)) {
      excluded.push(name)
    }
  }

  // Strip unknown omitSources that are not in the registry (still listed for transparency)
  for (const key of explicitOmit) {
    if (key === 'applePay') {
      // Already excluded product-wide; do not register.
      continue
    }
    if (!ENABLED_SOURCES.includes(key as (typeof ENABLED_SOURCES)[number])) {
      // Ignore unknown keys for exclusion list (cannot run anyway).
      continue
    }
  }

  return uniquePreserveOrder(excluded)
}

/** Builds a human/debug resolution describing ID impact of the policy. */
export function describePolicyImpact(policy: CollectionPolicy): PolicyResolution {
  const excludedSources = resolveExcludedSources(policy)
  const omittedCategories = [...(policy.omitCategories ?? [])] as SourceCategory[]
  const includedSourceCount = ENABLED_SOURCE_COUNT - excludedSources.length
  const notes: string[] = [
    'Opt-in collection policy — default load() without a policy is unchanged.',
    'Browser Permissions-Policy / privacy denials remain honored per source; this policy does not bypass them.',
    'Do not use categories or locale fixtures to classify nationality or region.',
  ]
  if (excludedSources.length > 0) {
    notes.push(
      `Excluding ${excludedSources.length} source(s) changes visitorId vs full default-v1 (41 sources). Document the policy version beside stored IDs.`,
    )
  } else {
    notes.push('No sources excluded; visitorId matches full default-profile set for the same environment.')
  }
  if (policy.allowCategories !== undefined) {
    notes.push(
      `allowCategories active (${policy.allowCategories.length} categor${policy.allowCategories.length === 1 ? 'y' : 'ies'}).`,
    )
  }
  if (policy.consent.purpose) {
    notes.push('Purpose string is integrator-owned disclosure metadata only.')
  }

  return {
    consentStatus: policy.consent.status,
    excludedSources,
    omittedCategories,
    includedSourceCount,
    visitorIdWillDifferFromFullDefault: excludedSources.length > 0,
    purpose: policy.consent.purpose,
    noticeVersion: policy.consent.noticeVersion,
    notes,
  }
}

/** Validates category names; throws TypeError on unknown category strings. */
export function assertKnownCategories(categories: readonly string[]): void {
  const known = new Set<string>(SOURCE_CATEGORIES)
  for (const category of categories) {
    if (!known.has(category)) {
      throw new TypeError(`Unknown source category: ${category}`)
    }
  }
}
