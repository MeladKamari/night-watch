import type {
  BuiltinComponents,
  BuiltinSourceOptions,
  Confidence,
  UnknownComponents,
  UnknownSources,
} from '@thenightwatch/core'

/**
 * Options for {@link Load}.
 *
 * Deviation from upstream: `monitoring` defaults to **false** and must not
 * send installation telemetry to third-party endpoints (D-003 / ADR-004).
 */
export interface LoadOptions {
  /**
   * Fallback delay (ms) when `requestIdleCallback` is unavailable.
   * Upstream default is 50.
   */
  delayFallback?: number
  /** Print debug messages to the console when supported by the agent. */
  debug?: boolean
  /**
   * Accepted for API familiarity with the pinned OSS shape.
   * Default: `false`. When true, this independent SDK still must not contact
   * FingerprintJS / openfpcdn monitoring URLs; behavior is documented as no-op
   * until an explicitly configured, separately authorized opt-in exists.
   */
  monitoring?: boolean
  /**
   * Builtin source keys to skip at collection time (insertion order of remaining keys preserved).
   * Prefer post-get {@link omitComponents} when you still want the raw component for diagnostics.
   */
  excludeSources?: readonly string[]
  /**
   * Extra entropy sources merged after default-profile built-ins.
   * By default does **not** override built-in keys; set `overwriteBuiltins` to replace.
   * Must never include the excluded payment key `applePay`.
   */
  customSources?: UnknownSources<BuiltinSourceOptions>
  /** When true, `customSources` may replace built-in keys of the same name. Default false. */
  overwriteBuiltins?: boolean
}

/** Options for {@link Agent.get}. */
export interface GetOptions {
  /**
   * Whether to print debug messages.
   * @deprecated Prefer `debug` on {@link LoadOptions} / `load()`.
   */
  debug?: boolean
}

/**
 * Result of {@link Agent.get}.
 * `version` is this SDK's package/algorithm version — not a forged upstream version.
 */
export interface GetResult {
  visitorId: string
  confidence: Confidence
  components: BuiltinComponents
  version: string
}

/** Agent instance returned by `load()`. */
export interface Agent {
  get(options?: Readonly<GetOptions>): Promise<GetResult>
}

/** Public `load()` signature (implementation in a later foundation step). */
export type Load = (options?: Readonly<LoadOptions>) => Promise<Agent>

/** Public `hashComponents()` signature (implementation in hashing step). */
export type HashComponents = (components: UnknownComponents) => string

/** Public `componentsToDebugString()` signature (implementation in debug step). */
export type ComponentsToDebugString = (components: UnknownComponents) => string

/**
 * Default export object shape (syntax sugar matching the pinned public API).
 * Functions are typed here; runtime wiring lands in later steps.
 */
export interface BrowserSdkDefaultExport {
  load: Load
  hashComponents: HashComponents
  componentsToDebugString: ComponentsToDebugString
}

export type {
  BuiltinComponents,
  BuiltinSourceOptions,
  BuiltinSources,
  Component,
  ComponentOutcomeKind,
  Confidence,
  MaybePromise,
  Source,
  SourcesToComponents,
  UnknownComponents,
  UnknownSources,
} from '@thenightwatch/core'
