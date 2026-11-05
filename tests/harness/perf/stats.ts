import type { DurationStats } from './types.js'

/**
 * Nearest-rank percentile on a sorted ascending copy.
 * Returns 0 for empty samples (callers should check sampleSize).
 */
export function percentile(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) {
    return 0
  }
  if (p <= 0) {
    return sortedAscending[0]!
  }
  if (p >= 100) {
    return sortedAscending[sortedAscending.length - 1]!
  }
  const rank = Math.ceil((p / 100) * sortedAscending.length) - 1
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank))
  return sortedAscending[index]!
}

/** Builds duration stats from an unsorted sample. Empty → zeros with sampleSize 0. */
export function summarizeDurations(values: readonly number[]): DurationStats {
  if (values.length === 0) {
    return {
      sampleSize: 0,
      min: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, n) => acc + n, 0)
  return {
    sampleSize: sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  }
}

/**
 * Timing resolution floor (ms). Means below this are ignored when deciding
 * relative-expensive flags (measurement noise, not an invented collection SLA).
 */
export const RELATIVE_COST_NOISE_FLOOR_MS = 1

/**
 * Marks sources whose mean exceeds `factor × max(noiseFloor, median of all means)`.
 * Using the full cohort median (often near 0) keeps the threshold at
 * `noiseFloor * factor` so genuinely heavier sources still surface for profiling.
 */
export function flagRelativeExpensive(
  meansByKey: Readonly<Record<string, number>>,
  factor: number,
  noiseFloorMs: number = RELATIVE_COST_NOISE_FLOOR_MS,
): ReadonlySet<string> {
  const means = Object.values(meansByKey)
  if (means.length === 0) {
    return new Set()
  }
  const median = percentile([...means].sort((a, b) => a - b), 50)
  const threshold = Math.max(noiseFloorMs, median) * factor
  const expensive = new Set<string>()
  for (const [key, mean] of Object.entries(meansByKey)) {
    if (mean >= noiseFloorMs && mean > threshold) {
      expensive.add(key)
    }
  }
  return expensive
}
