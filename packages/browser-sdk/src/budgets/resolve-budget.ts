import { CollectionBudgetError } from './errors.js'
import {
  RESOURCE_BUDGETS_REVISION,
  type CollectionBudget,
  type ResolvedCollectionBudget,
  type ResourceBudgetManifest,
  type ResourceBudgetResolution,
} from './types.js'

const DEFAULT_IDLE_YIELD_MS = 16

export function resolveCollectionBudget(
  budget: CollectionBudget,
): ResolvedCollectionBudget {
  if (budget == null || typeof budget !== 'object') {
    throw new CollectionBudgetError('budget must be an object')
  }

  const scheduling = budget.scheduling === 'idle' ? 'idle' : 'sync'
  const idleYieldMs =
    budget.idleYieldMs === undefined ? DEFAULT_IDLE_YIELD_MS : budget.idleYieldMs

  if (!Number.isFinite(idleYieldMs) || idleYieldMs < 0) {
    throw new CollectionBudgetError('idleYieldMs must be a non-negative finite number')
  }

  if (budget.totalTimeoutMs !== undefined) {
    if (!Number.isFinite(budget.totalTimeoutMs) || budget.totalTimeoutMs <= 0) {
      throw new CollectionBudgetError('totalTimeoutMs must be a positive finite number')
    }
  }
  if (budget.perSourceTimeoutMs !== undefined) {
    if (!Number.isFinite(budget.perSourceTimeoutMs) || budget.perSourceTimeoutMs <= 0) {
      throw new CollectionBudgetError('perSourceTimeoutMs must be a positive finite number')
    }
  }

  if (
    budget.signal === undefined &&
    budget.totalTimeoutMs === undefined &&
    budget.perSourceTimeoutMs === undefined &&
    budget.scheduling !== 'idle'
  ) {
    throw new CollectionBudgetError(
      'budget must specify signal, totalTimeoutMs, perSourceTimeoutMs, and/or scheduling: "idle"',
    )
  }

  if (budget.signal !== undefined && typeof budget.signal !== 'object') {
    throw new CollectionBudgetError('budget.signal must be an AbortSignal when provided')
  }

  const resolved: ResolvedCollectionBudget = {
    scheduling,
    idleYieldMs,
  }
  if (budget.signal !== undefined) {
    ;(resolved as { signal?: AbortSignal }).signal = budget.signal
  }
  if (budget.totalTimeoutMs !== undefined) {
    ;(resolved as { totalTimeoutMs?: number }).totalTimeoutMs = budget.totalTimeoutMs
  }
  if (budget.perSourceTimeoutMs !== undefined) {
    ;(resolved as { perSourceTimeoutMs?: number }).perSourceTimeoutMs = budget.perSourceTimeoutMs
  }
  return resolved
}

export function describeBudgetImpact(
  budget: ResolvedCollectionBudget,
): ResourceBudgetResolution {
  const manifest: ResourceBudgetManifest = {
    revision: RESOURCE_BUDGETS_REVISION,
    totalTimeoutMs: budget.totalTimeoutMs ?? null,
    perSourceTimeoutMs: budget.perSourceTimeoutMs ?? null,
    scheduling: budget.scheduling,
    idleYieldMs: budget.idleYieldMs,
    hasExternalSignal: budget.signal !== undefined,
    notes: [
      `Resource budgets ${RESOURCE_BUDGETS_REVISION}; default-profile registry unchanged.`,
      'Opt-in only — default load() ignores budgets.',
      'Timeout/abort yields error components — never fabricated success values.',
      'Partial error components change visitorId vs a fully successful run.',
    ],
  }

  return {
    manifest,
    mayAlterVisitorIdOnTimeoutOrAbort: true,
  }
}

export function resourceBudgetManifestToJson(manifest: ResourceBudgetManifest): string {
  return `${JSON.stringify(
    {
      revision: manifest.revision,
      totalTimeoutMs: manifest.totalTimeoutMs,
      perSourceTimeoutMs: manifest.perSourceTimeoutMs,
      scheduling: manifest.scheduling,
      idleYieldMs: manifest.idleYieldMs,
      hasExternalSignal: manifest.hasExternalSignal,
    },
    null,
    2,
  )}\n`
}
