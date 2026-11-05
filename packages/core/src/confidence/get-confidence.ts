import { detectConfidenceEnvironmentHints } from '../browser/confidence-hints.js'
import type { Confidence } from '../types.js'
import {
  NODE_SAFE_CONFIDENCE_ENVIRONMENT,
  resolveConfidenceEnvironment,
  type ConfidenceEnvironmentHints,
} from './environment.js'
import { getOpenConfidenceScore, type ConfidencePlatformComponents } from './heuristic.js'
import { assertScoreInUnitInterval, type ConfidenceModel } from './model.js'
import { round } from './round.js'

/**
 * Honest comment for the compatibility heuristic.
 * Deliberately omits FingerprintJS Pro marketing / fingerprint.com referral URLs (D-005).
 */
export function buildHeuristicConfidenceComment(openScore: number, derivedReferenceScale: number): string {
  return (
    `Heuristic compatibility score ${openScore} ` +
    `(reference-scale derived ${derivedReferenceScale}). ` +
    `Not a calibrated probability of uniqueness or identity.`
  )
}

/** Same derivation upstream used for its Pro comment number — kept for transparency only. */
export function deriveReferenceScaleScore(openConfidenceScore: number): number {
  return round(0.99 + 0.01 * openConfidenceScore, 0.0001)
}

export type GetConfidenceOptions = {
  /**
   * Partial override of engine hints (tests / forced fixtures).
   * Merged after live {@link detectConfidenceEnvironmentHints} (all-false under Node).
   */
  environment?: Partial<ConfidenceEnvironmentHints>
  /** When false, omit `comment`. Default true. */
  includeComment?: boolean
}

/**
 * Reference-compatible confidence for the Default-profile agent.
 * Mode: labeled OSS platform heuristic — not a statistical identity claim.
 * Live capability detectors feed environment hints; overrides win for tests.
 */
export function getConfidence(
  components: ConfidencePlatformComponents,
  options: GetConfidenceOptions = {},
): Confidence {
  const environment = resolveConfidenceEnvironment({
    ...detectConfidenceEnvironmentHints(),
    ...options.environment,
  })
  const openScore = assertScoreInUnitInterval(getOpenConfidenceScore(components, environment))
  const derived = deriveReferenceScaleScore(openScore)
  const includeComment = options.includeComment !== false

  if (!includeComment) {
    return { score: openScore }
  }

  return {
    score: openScore,
    comment: buildHeuristicConfidenceComment(openScore, derived),
  }
}

export const heuristicPlatformConfidenceModel: ConfidenceModel = {
  revision: 'heuristic-platform-v1',
  isCalibrated: false,
  score(components, environment) {
    // Explicit environment from callers — do not re-detect (avoids double-merge surprises).
    return getConfidence(components, {
      environment: resolveConfidenceEnvironment(environment),
    })
  },
}

/** Exported for tests: default Node-safe environment constant. */
export { NODE_SAFE_CONFIDENCE_ENVIRONMENT }
