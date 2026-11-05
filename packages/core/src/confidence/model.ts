import type { Confidence } from '../types.js'
import type { ConfidencePlatformComponents } from './heuristic.js'
import type { ConfidenceEnvironmentHints } from './environment.js'

/**
 * Pluggable confidence model contract.
 * Implementations must document whether scores are heuristic or calibrated.
 */
export interface ConfidenceModel {
  /** Model revision id (independent of package SemVer). */
  readonly revision: string
  /** True when scores are validated against an empirical dataset. */
  readonly isCalibrated: boolean
  score(
    components: ConfidencePlatformComponents,
    environment: ConfidenceEnvironmentHints,
  ): Confidence
}

/**
 * Placeholder for a future calibrated model.
 * Must not be used as a silent replacement for the heuristic baseline.
 */
export interface CalibratedConfidenceModel extends ConfidenceModel {
  readonly isCalibrated: true
  readonly datasetId: string
}

export function assertScoreInUnitInterval(score: number): number {
  if (!Number.isFinite(score)) {
    throw new TypeError(`Confidence score must be finite, received ${String(score)}`)
  }
  if (score < 0 || score > 1) {
    throw new RangeError(`Confidence score must be in [0, 1], received ${score}`)
  }
  return score
}
