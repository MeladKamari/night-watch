import {
  ALGORITHM_SCHEMA,
  ENABLED_SOURCES,
  ENABLED_SOURCE_COUNT,
  type EnabledSourceName,
} from '@thenightwatch/core'
import { categoryForSource } from '../policy/categories.js'
import { SOURCE_RELIABILITY_TIERS } from '../profiles/tiers.js'
import {
  SOURCE_METADATA_REGISTRY_REVISION,
  type SourceBrowserSupportHint,
  type SourceCostHint,
  type SourceMetadataRecord,
  type SourceMetadataRegistry,
} from './types.js'

const EXPENSIVE: ReadonlySet<string> = new Set([
  'fonts',
  'fontPreferences',
  'domBlockers',
  'audio',
  'canvas',
  'webGlBasics',
  'webGlExtensions',
])

const MODERATE_COST: ReadonlySet<string> = new Set([
  'userAgentData',
  'screenFrame',
  'audioBaseLatency',
  'plugins',
])

const WEBKIT_SENSITIVE: ReadonlySet<string> = new Set([
  'audio',
  'canvas',
  'privateClickMeasurement',
  'audioBaseLatency',
])

const LEGACY_RARE: ReadonlySet<string> = new Set([
  'osCpu',
  'cpuClass',
  'openDatabase',
])

const PERMISSIONED: ReadonlySet<string> = new Set(['userAgentData'])

const DEPENDS: Partial<Record<EnabledSourceName, readonly EnabledSourceName[]>> = {
  webGlExtensions: ['webGlBasics'],
  fontPreferences: ['fonts'],
  audioBaseLatency: ['audio'],
}

function costFor(name: EnabledSourceName): SourceCostHint {
  if (EXPENSIVE.has(name)) return 'expensive'
  if (MODERATE_COST.has(name)) return 'moderate'
  return 'cheap'
}

function browserSupportFor(name: EnabledSourceName): SourceBrowserSupportHint {
  if (PERMISSIONED.has(name)) return 'permissioned'
  if (LEGACY_RARE.has(name)) return 'legacy-rare'
  if (WEBKIT_SENSITIVE.has(name)) return 'webkit-sensitive'
  return 'widely'
}

function buildRecord(name: EnabledSourceName): SourceMetadataRecord {
  const privacyCategory = categoryForSource(name)
  if (!privacyCategory) {
    throw new Error(`Missing privacy category for ${name}`)
  }
  return {
    name,
    privacyCategory,
    stability: SOURCE_RELIABILITY_TIERS[name],
    cost: costFor(name),
    browserSupport: browserSupportFor(name),
    dependsOn: DEPENDS[name] ?? [],
    notes: [
      'Metadata only — does not alter collection order or visitorId.',
      `Manifest ${ALGORITHM_SCHEMA.sourceManifestRevision}; upstream behavioral pin v5.3.0.`,
    ],
  }
}

let cached: SourceMetadataRegistry | undefined

/**
 * Frozen opt-in metadata registry for the 41-source default-profile set.
 * Safe to call repeatedly; result is immutable and hash-neutral.
 */
export function getSourceMetadataRegistry(): SourceMetadataRegistry {
  if (cached) return cached
  if (ENABLED_SOURCE_COUNT !== 41) {
    throw new Error(`Expected 41 sources, got ${ENABLED_SOURCE_COUNT}`)
  }
  const records = ENABLED_SOURCES.map(buildRecord)
  if (records.some((r) => r.name === ('applePay' as EnabledSourceName))) {
    throw new Error('applePay must not appear in metadata registry')
  }
  cached = {
    revision: SOURCE_METADATA_REGISTRY_REVISION,
    sourceManifestRevision: ALGORITHM_SCHEMA.sourceManifestRevision,
    upstreamTag: 'v5.3.0',
    sourceCount: 41,
    excludesApplePay: true,
    records,
    notes: [
      `Source metadata ${SOURCE_METADATA_REGISTRY_REVISION}.`,
      'Opt-in documentation surface — default load()/hashComponents ignore this registry.',
      'Reproduces the v5.3.0-aligned 41-source set without the excluded payment source.',
    ],
  }
  return cached
}

export function sourceMetadataRegistryToJson(
  registry: SourceMetadataRegistry = getSourceMetadataRegistry(),
): string {
  return `${JSON.stringify(registry, null, 2)}\n`
}

export function getSourceMetadata(name: EnabledSourceName): SourceMetadataRecord {
  const row = getSourceMetadataRegistry().records.find((r) => r.name === name)
  if (!row) {
    throw new Error(`Unknown source metadata: ${name}`)
  }
  return row
}
