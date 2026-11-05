export type SignalBudget = {
  signalId: string
  timeoutMs: number
  skip?: boolean
}

export type CollectionBudgetConfig = {
  deadlineMs: number
  signals: readonly SignalBudget[]
  cacheTtlMs?: number
}

export type BudgetOutcome =
  | { status: 'ok'; signalId: string; value: unknown; ms: number }
  | { status: 'timeout'; signalId: string; ms: number }
  | { status: 'skipped'; signalId: string; reason: string }
  | { status: 'error'; signalId: string; message: string }
  | { status: 'cached'; signalId: string; value: unknown }

/**
 * Per-signal budgets over existing collectors — does not reimplement the 41 sources.
 */
export class CollectionBudgetRunner {
  private readonly cache = new Map<string, { value: unknown; expires: number }>()
  private readonly cfg: CollectionBudgetConfig

  constructor(cfg: CollectionBudgetConfig) {
    this.cfg = { cacheTtlMs: 5_000, ...cfg }
  }

  clearCache(): void {
    this.cache.clear()
  }

  async run(
    collectors: Record<string, () => Promise<unknown>>,
    now = Date.now(),
    isVisible: () => boolean = () => true,
  ): Promise<{ outcomes: BudgetOutcome[]; deadlineHit: boolean; warnings: string[] }> {
    const warnings: string[] = []
    const outcomes: BudgetOutcome[] = []
    const deadline = now + this.cfg.deadlineMs
    let deadlineHit = false

    if (!isVisible()) {
      warnings.push('document_hidden_deferred_scheduling')
    }

    for (const signal of this.cfg.signals) {
      if (Date.now() > deadline) {
        deadlineHit = true
        outcomes.push({ status: 'skipped', signalId: signal.signalId, reason: 'collection_deadline' })
        continue
      }

      if (signal.skip) {
        outcomes.push({ status: 'skipped', signalId: signal.signalId, reason: 'skip_policy' })
        continue
      }

      const cached = this.cache.get(signal.signalId)
      if (cached && cached.expires > Date.now()) {
        outcomes.push({ status: 'cached', signalId: signal.signalId, value: cached.value })
        continue
      }

      const collector = collectors[signal.signalId]
      if (!collector) {
        outcomes.push({ status: 'skipped', signalId: signal.signalId, reason: 'collector_missing_reuse_only' })
        continue
      }

      const started = Date.now()
      try {
        const value = await withTimeout(collector, signal.timeoutMs)
        const ms = Date.now() - started
        this.cache.set(signal.signalId, {
          value,
          expires: Date.now() + (this.cfg.cacheTtlMs ?? 5_000),
        })
        outcomes.push({ status: 'ok', signalId: signal.signalId, value, ms })
      } catch (err) {
        const ms = Date.now() - started
        const message = err instanceof Error ? err.message : String(err)
        if (message === 'timeout') {
          outcomes.push({ status: 'timeout', signalId: signal.signalId, ms })
          warnings.push(`timeout:${signal.signalId}`)
        } else {
          // Blocked APIs must not crash the runner
          outcomes.push({ status: 'error', signalId: signal.signalId, message })
          warnings.push(`isolated_error:${signal.signalId}`)
        }
      }
    }

    if (typeof performance === 'undefined') {
      warnings.push('performance_api_unavailable_budget_warn_only')
    }

    return { outcomes, deadlineHit, warnings }
  }
}

/** Local-only dynamic import helper — rejects absolute http(s) CDN URLs. */
export async function importLocalChunk<T>(specifier: string): Promise<T> {
  if (/^https?:\/\//i.test(specifier) || specifier.includes('://')) {
    throw new Error('cross_origin_cdn_import_forbidden')
  }
  return import(/* @vite-ignore */ specifier) as Promise<T>
}

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    fn().then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
