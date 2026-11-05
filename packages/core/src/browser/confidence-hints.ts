import type { ConfidenceEnvironmentHints } from '../confidence/environment.js'
import {
  isAndroid,
  isDesktopWebKit,
  isSafariWebKit,
  isWebKit,
  isWebKit616OrNewer,
} from './engines.js'
import type { BrowserContext } from './context.js'

/**
 * Builds confidence environment hints from live capability detectors.
 * Safe under Node (all false). Does not use locale, IP, or nationality.
 */
export function detectConfidenceEnvironmentHints(
  context?: BrowserContext,
): ConfidenceEnvironmentHints {
  return {
    isAndroid: isAndroid(context),
    isWebKit: isWebKit(context),
    isDesktopWebKit: isDesktopWebKit(context),
    isWebKit616OrNewer: isWebKit616OrNewer(context),
    isSafariWebKit: isSafariWebKit(context),
  }
}
