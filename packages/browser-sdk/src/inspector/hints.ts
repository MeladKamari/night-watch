import { SOURCE_RELIABILITY_TIERS } from '../profiles/tiers.js'
import type { ReliabilityTier } from '../profiles/types.js'
import type { SourceChangeKind } from './types.js'

export function expectedInstabilityFor(source: string): ReliabilityTier | 'unknown' {
  if (Object.prototype.hasOwnProperty.call(SOURCE_RELIABILITY_TIERS, source)) {
    return SOURCE_RELIABILITY_TIERS[source as keyof typeof SOURCE_RELIABILITY_TIERS]
  }
  return 'unknown'
}

/**
 * Short probabilistic hint — never claims identity continuity or uniqueness.
 */
export function hintForChange(
  source: string,
  kind: SourceChangeKind,
  instability: ReliabilityTier | 'unknown',
): string {
  if (kind === 'unchanged') {
    return 'No observed component change for this source in the compared pair.'
  }
  if (kind === 'added') {
    return 'Source appeared only in the after collection (set membership changed).'
  }
  if (kind === 'removed') {
    return 'Source present only in the before collection (set membership changed).'
  }
  if (kind === 'duration_only') {
    return 'Value/error arm unchanged; duration delta only — usually not identity-relevant.'
  }

  if (instability === 'volatile') {
    return `Volatile source "${source}" often changes across sessions/privacy modes — weak continuity signal.`
  }
  if (instability === 'moderate') {
    return `Moderate source "${source}" may change with locale, display, or preference shifts.`
  }
  if (instability === 'stable') {
    return `Stable-tier source "${source}" changed — unexpected more often than volatile sources, still not identity proof.`
  }
  return `Custom/unknown source "${source}" changed — interpret only as a local entropy delta.`
}
