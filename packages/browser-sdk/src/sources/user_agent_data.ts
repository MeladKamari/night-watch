import { getNavigator, type BuiltinSourceOptions, type Source } from '@night-watch/core'

type HighEntropyValues = {
  architecture?: string
  bitness?: string
  model?: string
  platformVersion?: string
}

/** Minimal UA-CH surface used by this collector (Chromium-family). */
export interface NavigatorUAData {
  brands: Array<{ brand: string; version: string }>
  mobile: boolean
  platform: string
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>
}

/**
 * Present only when high-entropy collection was blocked by a Permissions Policy.
 * Stable string so it contributes to the fingerprint hash.
 */
export const HighEntropyStatus = {
  NotAllowed: 'not_allowed',
} as const

export type HighEntropyStatusCode = (typeof HighEntropyStatus)[keyof typeof HighEntropyStatus]

export type StableUserAgentData = {
  brands: string[]
  mobile: boolean
  platform: string
  architecture?: string
  bitness?: string
  model?: string
  platformVersion?: string
  highEntropyStatus?: HighEntropyStatusCode
}

/**
 * GREASE brands are intentional fake entries (e.g. "Not_A Brand") to prevent API ossification.
 * Match Chromium’s “contains Not” heuristic (case-insensitive).
 */
export function isGreaseBrand(brand: string): boolean {
  return /not/i.test(brand)
}

/**
 * Pure transform of a UA-CH snapshot into the stable component value.
 * Returns `undefined` when the API is absent — that is a hashed value, not an error.
 */
export async function collectUserAgentData(
  uaData: NavigatorUAData | null | undefined,
): Promise<StableUserAgentData | undefined> {
  if (!uaData) {
    return undefined
  }

  const filteredBrands = uaData.brands
    .filter(({ brand }) => !isGreaseBrand(brand))
    .map(({ brand }) => brand)

  // Prefer product brand over generic "Chromium" when both are present.
  const brands =
    filteredBrands.length > 1 ? filteredBrands.filter((b) => b !== 'Chromium') : filteredBrands

  const result: StableUserAgentData = {
    brands,
    mobile: uaData.mobile,
    platform: uaData.platform,
  }

  if (typeof uaData.getHighEntropyValues === 'function') {
    try {
      const highEntropy = await uaData.getHighEntropyValues([
        'architecture',
        'bitness',
        'model',
        'platformVersion',
      ])
      // Assign only defined fields (exactOptionalPropertyTypes); JSON omits undefined either way.
      if (highEntropy.architecture !== undefined) {
        result.architecture = highEntropy.architecture
      }
      if (highEntropy.bitness !== undefined) {
        result.bitness = highEntropy.bitness
      }
      if (highEntropy.model !== undefined) {
        result.model = highEntropy.model
      }
      if (highEntropy.platformVersion !== undefined) {
        result.platformVersion = highEntropy.platformVersion
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        result.highEntropyStatus = HighEntropyStatus.NotAllowed
      } else if (
        // Node / non-DOM hosts may throw Error with the same name.
        error instanceof Error &&
        error.name === 'NotAllowedError'
      ) {
        result.highEntropyStatus = HighEntropyStatus.NotAllowed
      } else {
        throw error
      }
    }
  }

  return result
}

function readNavigatorUAData(): NavigatorUAData | undefined {
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  const uaData = (navProbe.value as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
  return uaData
}

/**
 * Entropy source: User-Agent Client Hints (`navigator.userAgentData`).
 * Chromium-family only; Firefox/Safari typically yield `undefined` (supported absence).
 */
export const getUserAgentData: Source<BuiltinSourceOptions, StableUserAgentData | undefined> = (
  _options,
) => collectUserAgentData(readNavigatorUAData())
