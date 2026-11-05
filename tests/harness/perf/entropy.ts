import { countVisitorIds } from './stability.js'
import type { CollisionCohort } from './types.js'

/**
 * Collision / uniqueness stats for a consented cohort.
 * Never interprets the ratio as a worldwide false-positive or uniqueness claim.
 */
export function summarizeCollisions(
  label: string,
  visitorIds: readonly string[],
  notes: readonly string[] = [],
): CollisionCohort {
  const counts = countVisitorIds(visitorIds)
  let collisionPairsApprox = 0
  for (const count of counts.values()) {
    if (count >= 2) {
      // Combinations C(n,2) among samples sharing this id.
      collisionPairsApprox += (count * (count - 1)) / 2
    }
  }
  const sampleSize = visitorIds.length
  return {
    label,
    sampleSize,
    uniqueVisitorIds: counts.size,
    collisionPairsApprox,
    uniquenessRatio: sampleSize === 0 ? 0 : counts.size / sampleSize,
    notes: [...notes],
  }
}
