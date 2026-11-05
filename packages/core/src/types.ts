import {
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
  type EnabledSourceName,
} from './registry.js'
import { CORE_PACKAGE_VERSION } from './package-meta.js'

/** Value or Promise of that value (upstream-compatible async surface). */
export type MaybePromise<T> = T | Promise<T>

/**
 * Entropy source function.
 * May return: sync value | Promise value | deferred getter | Promise of deferred getter.
 */
export type Source<TOptions, TValue> = (
  options: TOptions,
) => MaybePromise<TValue | (() => MaybePromise<TValue>)>

/**
 * Generic dictionary of unknown sources.
 * Options default to `never` so maps with concrete option types remain assignable.
 */
export type UnknownSources<TOptions = never> = Record<string, Source<TOptions, unknown>>

/** Extracts the value type parameter from a {@link Source}. */
export type SourceValue<TSource> = TSource extends Source<infer _TOptions, infer TValue>
  ? TValue
  : never

/**
 * Per-source collection result.
 * Discriminated by presence of `value` vs `error`. Duration is never hashed.
 */
export type Component<T> =
  | { value: T; duration: number }
  | { error: unknown; duration: number }

/** Generic component map (keys not restricted to the built-in registry). */
export type UnknownComponents = Record<string, Component<unknown>>

/**
 * Maps a sources object type to the corresponding components object type.
 * Constraint is intentionally loose (matches upstream entropy_source flexibility).
 */
export type SourcesToComponents<TSources extends Record<string, Source<never, unknown>>> = {
  [K in keyof TSources]: Component<SourceValue<TSources[K]>>
}

/**
 * Confidence is a **heuristic**, not a calibrated probability.
 * Do not treat `score` as a statistical uniqueness guarantee.
 */
export interface Confidence {
  /** Approximate heuristic in \[0, 1\]. */
  score: number
  /** Optional human-readable note (no vendor marketing URLs). */
  comment?: string
}

/**
 * Conceptual collector outcome categories.
 * Unexpected exceptions use `{ error, duration }`.
 * Unsupported/blocked cases are usually source-specific sentinel **values**, not `error`.
 * Do not conflate these categories when comparing parity.
 */
export type ComponentOutcomeKind = 'value' | 'unsupported' | 'blocked' | 'error'

/** Built-in Default-profile components: exactly the 41 enabled keys, no `applePay`. */
export type BuiltinComponents = {
  [K in EnabledSourceName]: Component<unknown>
}

/** Options passed into built-in sources (filled by the agent/engine in later steps). */
export interface BuiltinSourceOptions {
  debug?: boolean
  cache: Record<string, unknown>
  /**
   * Optional abort signal (opt-in resource budgets / step 67).
   * Default `load()` never sets this; collectors that support cooperative abort
   * (e.g. iframe helpers) forward it when present.
   */
  signal?: AbortSignal
}

/** Built-in source registry map type (implementation arrives in source steps). */
export type BuiltinSources = {
  [K in EnabledSourceName]: Source<BuiltinSourceOptions, unknown>
}

/**
 * Versioned internal algorithm schema.
 * `sourceManifestRevision` changes when the enabled source set or value semantics change.
 * Hashing/confidence revisions bump independently when those algorithms change.
 */
export interface AlgorithmSchema {
  readonly sourceManifestRevision: typeof SOURCE_MANIFEST_REVISION
  /** Locked name for the MurmurHash3 x64 128 + canonicalization pair (implemented in step 08). */
  readonly hashingRevision: 'murmur3-x64-128-canonical-v1'
  /** Locked name for the open-source-style heuristic confidence model (step 09). */
  readonly confidenceRevision: 'heuristic-platform-v1'
  readonly packageVersion: string
  readonly enabledSourceCount: 41
  readonly enabledSources: readonly EnabledSourceName[]
}

export const ALGORITHM_SCHEMA: AlgorithmSchema = {
  sourceManifestRevision: SOURCE_MANIFEST_REVISION,
  hashingRevision: 'murmur3-x64-128-canonical-v1',
  confidenceRevision: 'heuristic-platform-v1',
  packageVersion: CORE_PACKAGE_VERSION,
  enabledSourceCount: 41,
  enabledSources: ENABLED_SOURCES,
}

export function isValueComponent<T>(
  component: Component<T>,
): component is { value: T; duration: number } {
  return 'value' in component
}

export function isErrorComponent<T>(
  component: Component<T>,
): component is { error: unknown; duration: number } {
  return 'error' in component
}

/**
 * Type-level proof that `applePay` is not part of the enabled source union.
 * If this line fails to compile, the exclusion invariant was broken.
 */
export type AssertApplePayExcluded = Extract<EnabledSourceName, 'applePay'> extends never
  ? true
  : never

export const APPLE_PAY_EXCLUDED: AssertApplePayExcluded = true
