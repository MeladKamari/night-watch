/**
 * Browser-engine hints used only by the open-source compatibility heuristic.
 * Live detectors: {@link import('../browser/confidence-hints.js').detectConfidenceEnvironmentHints}.
 * Defaults are safe for Node/SSR (all false → platform-string path).
 */
export interface ConfidenceEnvironmentHints {
  isAndroid: boolean
  isWebKit: boolean
  isDesktopWebKit: boolean
  isWebKit616OrNewer: boolean
  isSafariWebKit: boolean
}

export const NODE_SAFE_CONFIDENCE_ENVIRONMENT: ConfidenceEnvironmentHints = {
  isAndroid: false,
  isWebKit: false,
  isDesktopWebKit: false,
  isWebKit616OrNewer: false,
  isSafariWebKit: false,
}

/**
 * Merges overrides onto Node-safe defaults without throwing.
 * Does not infer nationality/locale; does not read languages or timezones.
 * Prefer {@link import('./get-confidence.js').getConfidence}, which also merges live detector hints.
 */
export function resolveConfidenceEnvironment(
  overrides?: Partial<ConfidenceEnvironmentHints>,
): ConfidenceEnvironmentHints {
  return {
    ...NODE_SAFE_CONFIDENCE_ENVIRONMENT,
    ...overrides,
  }
}
