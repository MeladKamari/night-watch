import type { Component } from '../types.js'
import type { ConfidenceEnvironmentHints } from './environment.js'

export type ConfidencePlatformComponents = {
  platform?: Component<unknown>
}

/**
 * Open-source compatibility heuristic scores (FingerprintJS OSS v5.3.0 bands).
 * These are **not** calibrated probabilities of uniqueness or identity.
 */
export const HEURISTIC_SCORES = {
  android: 0.4,
  webkitMobileOrModernSafari: 0.3,
  webkitDesktopLegacy: 0.5,
  windows: 0.6,
  mac: 0.5,
  other: 0.7,
} as const

function platformString(components: ConfidencePlatformComponents): string {
  const platformComponent = components.platform
  if (!platformComponent || !('value' in platformComponent)) {
    return ''
  }
  const value = platformComponent.value
  return typeof value === 'string' ? value : ''
}

/**
 * Computes the open (OSS) confidence score from platform + engine hints.
 * Locale, Persian language, IP, and device brand must never be inputs here.
 */
export function getOpenConfidenceScore(
  components: ConfidencePlatformComponents,
  environment: ConfidenceEnvironmentHints,
): number {
  if (environment.isAndroid) {
    return HEURISTIC_SCORES.android
  }

  if (environment.isWebKit) {
    return environment.isDesktopWebKit &&
      !(environment.isWebKit616OrNewer && environment.isSafariWebKit)
      ? HEURISTIC_SCORES.webkitDesktopLegacy
      : HEURISTIC_SCORES.webkitMobileOrModernSafari
  }

  const platform = platformString(components)

  if (/^Win/.test(platform)) {
    return HEURISTIC_SCORES.windows
  }

  if (/^Mac/.test(platform)) {
    return HEURISTIC_SCORES.mac
  }

  return HEURISTIC_SCORES.other
}
