import type { StabilityRun } from './types.js'

/** Counts occurrences of each visitorId. */
export function countVisitorIds(
  visitorIds: readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of visitorIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Builds a stability summary for one labeled cohort (e.g. 20 reloads). */
export function summarizeStability(
  label: string,
  visitorIds: readonly string[],
  notes: readonly string[] = [],
): StabilityRun {
  const counts = countVisitorIds(visitorIds)
  let majorityVisitorId: string | undefined
  let majorityCount = 0
  for (const [id, count] of counts) {
    if (count > majorityCount) {
      majorityVisitorId = id
      majorityCount = count
    }
  }
  const sampleSize = visitorIds.length
  return {
    label,
    visitorIds: [...visitorIds],
    uniqueCount: counts.size,
    majorityVisitorId,
    majorityShare: sampleSize === 0 ? 0 : majorityCount / sampleSize,
    notes: [...notes],
  }
}
