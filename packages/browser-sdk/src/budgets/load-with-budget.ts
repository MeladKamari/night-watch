import {
  assertBrowserEnvironment,
  loadSources,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
  type UnknownComponents,
} from '@thenightwatch/core'
import {
  createAgent,
  handleMonitoringOption,
  prepareForSources,
  type LoadAgentOptions,
} from '../agent.js'
import { mergeBuiltinSources } from '../sources/merge-sources.js'
import type { Agent } from '../types.js'
import {
  CollectionAbortError,
  CollectionTimeoutError,
} from './errors.js'
import { describeBudgetImpact, resolveCollectionBudget } from './resolve-budget.js'
import {
  createTimerRegistry,
  linkAbortSignals,
  throwIfAborted,
  type TimerRegistry,
} from './timers.js'
import type { CollectionBudget, ResourceBudgetResolution } from './types.js'
import { wrapSourcesWithBudget } from './wrap-sources.js'

const DEFAULT_DELAY_FALLBACK_MS = 50

export type LoadWithResourceBudgetOptions = LoadAgentOptions & {
  /** Required opt-in budget. Default {@link import('../agent.js').load} ignores budgets. */
  readonly budget: CollectionBudget
}

export type LoadWithResourceBudgetResult = {
  readonly agent: Agent
  readonly resolution: ResourceBudgetResolution
  /** Clears pending budget timers (also runs after collection settles). */
  readonly dispose: () => void
  /** Test/ops: pending scheduled budget timers. */
  readonly getPendingTimerCount: () => number
}

/**
 * Opt-in loader: abort signal, total collection budget, per-source timeouts,
 * and optional idle scheduling. Default {@link import('../agent.js').load} is
 * unchanged when unused.
 *
 * Timeout/abort never fabricates success values — affected sources become
 * error components (or the load throws if aborted before collectors start).
 */
export async function loadWithResourceBudget(
  options: LoadWithResourceBudgetOptions,
): Promise<LoadWithResourceBudgetResult> {
  const { budget: budgetInput, ...loadOptions } = options
  const budget = resolveCollectionBudget(budgetInput)
  const resolution = describeBudgetImpact(budget)
  const timers = createTimerRegistry()

  const delayFallback = loadOptions.delayFallback ?? DEFAULT_DELAY_FALLBACK_MS
  const debug = loadOptions.debug === true
  const monitoring = loadOptions.monitoring === true

  handleMonitoringOption(monitoring)

  const hasCollectableRegistry =
    loadOptions.sources !== undefined || loadOptions.customSources !== undefined
  const allowNonBrowser = loadOptions.allowNonBrowser === true && hasCollectableRegistry
  if (!allowNonBrowser) {
    assertBrowserEnvironment()
  }

  const totalController =
    budget.totalTimeoutMs !== undefined && typeof AbortController !== 'undefined'
      ? new AbortController()
      : undefined

  let totalTimer: ReturnType<TimerRegistry['schedule']> | undefined
  if (totalController && budget.totalTimeoutMs !== undefined) {
    totalTimer = timers.schedule(() => {
      totalController.abort(new CollectionTimeoutError(budget.totalTimeoutMs!))
    }, budget.totalTimeoutMs)
  }

  const linkedSignal = linkAbortSignals(budget.signal, totalController?.signal)

  const dispose = () => {
    totalTimer?.clear()
    timers.clearAll()
  }

  try {
    if (budget.signal?.aborted || linkedSignal?.aborted) {
      throw new CollectionAbortError(
        budget.signal?.reason instanceof Error
          ? budget.signal.reason.message
          : 'Fingerprint collection was aborted',
      )
    }

    await prepareForSources(delayFallback)
    throwIfAborted(linkedSignal)

    const baseSources: BuiltinSources =
      loadOptions.sources ??
      mergeBuiltinSources(loadOptions.customSources ?? {}, {
        overwriteBuiltins: loadOptions.overwriteBuiltins === true,
      })

    const wrapped = wrapSourcesWithBudget<BuiltinSourceOptions>(
      baseSources as Record<string, Source<BuiltinSourceOptions, unknown>>,
      budget,
      linkedSignal,
      timers,
    ) as BuiltinSources

    const excludeSources = loadOptions.excludeSources ?? []
    const sourceOptions: BuiltinSourceOptions = linkedSignal
      ? { cache: {}, debug, signal: linkedSignal }
      : { cache: {}, debug }

    const loopReleaseInterval =
      budget.scheduling === 'idle' ? Math.max(1, budget.idleYieldMs) : undefined

    const getComponentsRaw = loadSources(
      wrapped,
      sourceOptions,
      excludeSources,
      loopReleaseInterval,
    )

    const getComponents = async (): Promise<UnknownComponents> => {
      try {
        throwIfAborted(linkedSignal)
        const components = await getComponentsRaw()
        return components as UnknownComponents
      } finally {
        dispose()
      }
    }

    const agent = createAgent(getComponents, { debug })

    return {
      agent,
      resolution,
      dispose,
      getPendingTimerCount: () => timers.pendingCount,
    }
  } catch (error) {
    dispose()
    if (isAbortLike(error)) {
      throw error instanceof CollectionAbortError ||
        error instanceof CollectionTimeoutError
        ? error
        : new CollectionAbortError(
            error instanceof Error ? error.message : 'Fingerprint collection was aborted',
          )
    }
    throw error
  }
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof CollectionAbortError || error instanceof CollectionTimeoutError) {
    return true
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }
  return false
}
