import type { Confidence } from '@night-watch/core'

/** Versioned diagnostics catalog (independent of `SOURCE_MANIFEST_REVISION`). */
export const DIAGNOSTICS_REVISION = 'night-watch-diagnostics-v1' as const

/** JSON schema id embedded in every snapshot for validation. */
export const DIAGNOSTICS_SNAPSHOT_SCHEMA = 'night-watch-diagnostics-snapshot-v1' as const

export type DiagnosticsRevision = typeof DIAGNOSTICS_REVISION
export type DiagnosticsSnapshotSchema = typeof DIAGNOSTICS_SNAPSHOT_SCHEMA

/**
 * Options for building a local diagnostic snapshot.
 * Never enables network export — callers must invoke {@link import('./export-snapshot.js').exportDiagnosticSnapshot} explicitly.
 */
export type DiagnosticExportOptions = {
  /**
   * Lab/repro seed. Included only as a hashed fingerprint (`reproSeedHash`) unless
   * `includeRawReproSeed` is true (lab machines only).
   */
  readonly reproSeed?: string
  /** When true, also embeds the raw `reproSeed` string (default false). */
  readonly includeRawReproSeed?: boolean
  /**
   * Include redacted environment hints (UA, languages, secureContext).
   * Never includes href / title / cookie / referrer.
   */
  readonly includeEnvironment?: boolean
  /** Override package version string in the snapshot (tests). */
  readonly packageVersion?: string
  /** Fixed exportedAt for deterministic fixtures (ISO-8601). */
  readonly exportedAt?: string
}

/** Redacted environment block — no direct page-identifying context. */
export type DiagnosticEnvironment = {
  readonly userAgent?: string
  readonly language?: string
  readonly languages?: readonly string[]
  readonly platform?: string
  readonly secureContext?: boolean
  readonly documentDir?: string
  /** Always true when this block is present — page URL/title/cookies are omitted by design. */
  readonly pageContextRedacted: true
}

export type DiagnosticComponentSnapshot = {
  readonly value?: unknown
  readonly error?: Record<string, unknown>
  readonly duration: number
}

export type DiagnosticSnapshot = {
  readonly schema: DiagnosticsSnapshotSchema
  readonly revision: DiagnosticsRevision
  readonly exportedAt: string
  readonly packageVersion: string
  readonly sourceManifestRevision: string
  readonly hashingRevision: string
  readonly confidenceRevision: string
  readonly visitorId: string
  readonly confidence: Confidence
  readonly componentKeys: readonly string[]
  readonly components: Readonly<Record<string, DiagnosticComponentSnapshot>>
  readonly environment?: DiagnosticEnvironment
  readonly reproSeedHash?: string
  readonly reproSeed?: string
  readonly notes: readonly string[]
}

export type DiagnosticExportResult = {
  readonly snapshot: DiagnosticSnapshot
  /** Canonical JSON text (pretty-printed). Local only — never uploaded by the SDK. */
  readonly json: string
  readonly byteLength: number
}

export type DiagnosticValidationResult =
  | { readonly ok: true; readonly snapshot: DiagnosticSnapshot }
  | { readonly ok: false; readonly errors: readonly string[] }
