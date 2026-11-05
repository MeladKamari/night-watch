import { ENABLED_SOURCES, type EnabledSourceName } from '@night-watch/core'

/**
 * Privacy-oriented source categories for optional collection policies.
 * Categories are **not** regional classifiers — do not map them to nationality.
 */
export const SOURCE_CATEGORIES = [
  'identityHints',
  'locale',
  'display',
  'hardware',
  'storage',
  'rendering',
  'audio',
  'plugins',
  'attribution',
  'math',
] as const

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number]

/** Stable category → sources map (Default-profile 41 only; never includes applePay). */
export const SOURCES_BY_CATEGORY: Readonly<Record<SourceCategory, readonly EnabledSourceName[]>> = {
  identityHints: [
    'userAgentData',
    'osCpu',
    'cpuClass',
    'platform',
    'vendor',
    'vendorFlavors',
    'architecture',
  ],
  locale: ['languages', 'timezone', 'dateTimeLocale'],
  display: [
    'colorDepth',
    'screenResolution',
    'screenFrame',
    'colorGamut',
    'invertedColors',
    'forcedColors',
    'monochrome',
    'contrast',
    'reducedMotion',
    'reducedTransparency',
    'hdr',
  ],
  hardware: ['deviceMemory', 'hardwareConcurrency', 'touchSupport'],
  storage: [
    'sessionStorage',
    'localStorage',
    'indexedDB',
    'openDatabase',
    'cookiesEnabled',
  ],
  rendering: [
    'fonts',
    'domBlockers',
    'fontPreferences',
    'canvas',
    'webGlBasics',
    'webGlExtensions',
  ],
  audio: ['audio', 'audioBaseLatency'],
  plugins: ['plugins', 'pdfViewerEnabled'],
  attribution: ['privateClickMeasurement'],
  math: ['math'],
}

const categoryBySource: Map<string, SourceCategory> = (() => {
  const map = new Map<string, SourceCategory>()
  for (const category of SOURCE_CATEGORIES) {
    for (const source of SOURCES_BY_CATEGORY[category]) {
      map.set(source, category)
    }
  }
  return map
})()

/** Returns the category for an Default-profile source, or undefined if unknown. */
export function categoryForSource(source: string): SourceCategory | undefined {
  return categoryBySource.get(source)
}

/** Flattens categories into a unique source list (ENABLED_SOURCES order). */
export function sourcesInCategories(
  categories: readonly SourceCategory[],
): EnabledSourceName[] {
  const wanted = new Set<string>()
  for (const category of categories) {
    for (const source of SOURCES_BY_CATEGORY[category] ?? []) {
      wanted.add(source)
    }
  }
  return ENABLED_SOURCES.filter((name) => wanted.has(name))
}

/** Assert every Default-profile source is categorized exactly once (module invariant). */
export function assertCategoryCoverage(): void {
  const seen = new Set<string>()
  for (const category of SOURCE_CATEGORIES) {
    for (const source of SOURCES_BY_CATEGORY[category]) {
      if (seen.has(source)) {
        throw new Error(`Source "${source}" appears in multiple categories`)
      }
      seen.add(source)
    }
  }
  if (seen.size !== ENABLED_SOURCES.length) {
    throw new Error(
      `Category coverage ${seen.size} !== ENABLED_SOURCES ${ENABLED_SOURCES.length}`,
    )
  }
  for (const name of ENABLED_SOURCES) {
    if (!seen.has(name)) {
      throw new Error(`Source "${name}" missing from categories`)
    }
  }
  if (seen.has('applePay')) {
    throw new Error('applePay must not appear in categories')
  }
}
