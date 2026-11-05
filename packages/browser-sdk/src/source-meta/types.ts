import type { EnabledSourceName } from '@night-watch/core'
import type { SourceCategory } from '../policy/categories.js'
import type { ReliabilityTier } from '../profiles/types.js'

/**
 * Opt-in metadata registry revision.
 * Changing this does **not** change visitorId / `SOURCE_MANIFEST_REVISION`.
 */
export const SOURCE_METADATA_REGISTRY_REVISION = 'night-watch-source-metadata-v1' as const

export type SourceMetadataRegistryRevision = typeof SOURCE_METADATA_REGISTRY_REVISION

/** Relative collection cost hint (operational, not a SLA). */
export type SourceCostHint = 'cheap' | 'moderate' | 'expensive'

export type SourceBrowserSupportHint =
  | 'widely'
  | 'chromium-mostly'
  | 'webkit-sensitive'
  | 'legacy-rare'
  | 'permissioned'

export type SourceMetadataRecord = {
  readonly name: EnabledSourceName
  readonly privacyCategory: SourceCategory
  readonly stability: ReliabilityTier
  readonly cost: SourceCostHint
  readonly browserSupport: SourceBrowserSupportHint
  /** Other enabled sources that conceptually precede this one (documentation / plugin planning). */
  readonly dependsOn: readonly EnabledSourceName[]
  readonly notes: readonly string[]
}

export type SourceMetadataRegistry = {
  readonly revision: SourceMetadataRegistryRevision
  /** Always mirrors `SOURCE_MANIFEST_REVISION` for the frozen v5.3.0-aligned set. */
  readonly sourceManifestRevision: string
  readonly upstreamTag: 'v5.3.0'
  readonly sourceCount: 41
  readonly excludesApplePay: true
  readonly records: readonly SourceMetadataRecord[]
  readonly notes: readonly string[]
}
