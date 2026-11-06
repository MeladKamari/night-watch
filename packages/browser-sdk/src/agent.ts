import {
  ALGORITHM_SCHEMA,
  assertBrowserEnvironment,
  componentsToDebugString,
  getConfidence,
  getWindow,
  hashComponents,
  loadSources,
  requestIdleCallbackIfAvailable,
  type BuiltinComponents,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type UnknownComponents,
} from '@thenightwatch/core'
import { SDK_PACKAGE_VERSION } from './package-meta.js'
import { mergeBuiltinSources } from './sources/merge-sources.js'
import type { Agent, GetOptions, GetResult, LoadOptions } from './types.js'

const DEFAULT_DELAY_FALLBACK_MS = 50

/**
 * Idle/fallback delay before sources run (FingerprintJS OSS issue #254 / #307).
 * Deadline is `2 * delayFallback` so idle and timeout paths share similar average wait.
 */
export function prepareForSources(delayFallback = DEFAULT_DELAY_FALLBACK_MS): Promise<void> {
  return requestIdleCallbackIfAvailable(delayFallback, delayFallback * 2)
}

/**
 * Monitoring is accepted for API familiarity but is a **no-op** here:
 * this SDK never contacts FingerprintJS / openfpcdn or other vendor telemetry endpoints.
 */
export function handleMonitoringOption(_monitoring: boolean): void {
  // Intentionally empty — D-003 / ADR-004 / ADR-012.
}

function makeLazyGetResult(components: UnknownComponents): GetResult {
  let visitorIdCache: string | undefined
  const platform = components.platform as BuiltinComponents['platform'] | undefined
  const confidence = getConfidence(
    platform === undefined ? {} : { platform },
  )

  return {
    get visitorId(): string {
      if (visitorIdCache === undefined) {
        visitorIdCache = hashComponents(components)
      }
      return visitorIdCache
    },
    set visitorId(visitorId: string) {
      visitorIdCache = visitorId
    },
    confidence,
    components: components as BuiltinComponents,
    version: SDK_PACKAGE_VERSION,
  }
}

export type CreateAgentOptions = {
  debug?: boolean
  /** Override creation timestamp (tests). */
  createdAt?: number
}

/**
 * Builds an Agent around an already-started components getter.
 * Does not touch browser globals by itself.
 */
export function createAgent(
  getComponents: () => Promise<UnknownComponents>,
  options: CreateAgentOptions = {},
): Agent {
  const creationTime = options.createdAt ?? Date.now()
  const debug = options.debug === true

  return {
    async get(getOptions: Readonly<GetOptions> = {}) {
      const startTime = Date.now()
      const components = await getComponents()
      const result = makeLazyGetResult(components)

      if (debug || getOptions.debug === true) {
        logDebugBundle(result, startTime - creationTime)
      }

      return result
    },
  }
}

function logDebugBundle(result: GetResult, timeBetweenLoadAndGet: number): void {
  const windowProbe = getWindow()
  const userAgent =
    windowProbe.status === 'ok' ? windowProbe.value.navigator.userAgent : '(unavailable)'

  // Debug-only stdout; gated by load()/get() debug flags.
  console.log(`Copy the text below to get the debug data:

\`\`\`
version: ${result.version}
sourceManifestRevision: ${ALGORITHM_SCHEMA.sourceManifestRevision}
userAgent: ${userAgent}
timeBetweenLoadAndGet: ${timeBetweenLoadAndGet}
visitorId: ${result.visitorId}
components: ${componentsToDebugString(result.components)}
\`\`\``)
}

export type LoadAgentOptions = Readonly<
  LoadOptions & {
    /**
     * Replace builtin sources (unit tests). When set with `allowNonBrowser`,
     * skips the browser environment assertion.
     */
    sources?: BuiltinSources
    /**
     * Test-only: allow running outside a browser when `sources` and/or
     * `customSources` supply a collectable registry (no live DOM required).
     */
    allowNonBrowser?: boolean
  }
>

/**
 * Loads the fingerprinting agent: optional idle wait, start collectors, return Agent.
 * SSR-safe to **import**; calling `load()` without a browser throws
 * {@link import('@thenightwatch/core').UnsupportedEnvironmentError} unless test overrides apply.
 */
export async function load(options: LoadAgentOptions = {}): Promise<Agent> {
  const delayFallback = options.delayFallback ?? DEFAULT_DELAY_FALLBACK_MS
  const debug = options.debug === true
  const monitoring = options.monitoring === true

  handleMonitoringOption(monitoring)

  const hasCollectableRegistry =
    options.sources !== undefined || options.customSources !== undefined
  const allowNonBrowser = options.allowNonBrowser === true && hasCollectableRegistry
  if (!allowNonBrowser) {
    assertBrowserEnvironment()
  }

  await prepareForSources(delayFallback)

  const sources =
    options.sources ??
    mergeBuiltinSources(options.customSources ?? {}, {
      overwriteBuiltins: options.overwriteBuiltins === true,
    })
  const excludeSources = options.excludeSources ?? []
  const sourceOptions: BuiltinSourceOptions = { cache: {}, debug }
  const getComponents = loadSources(sources, sourceOptions, excludeSources)

  return createAgent(getComponents, { debug })
}
