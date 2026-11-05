import {
  ENABLED_SOURCES,
  RESOURCE_BUDGETS_REVISION,
  CollectionAbortError,
  CollectionBudgetError,
  CollectionTimeoutError,
  SourceTimeoutError,
  createBuiltinSources,
  createTimerRegistry,
  describeBudgetImpact,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  loadWithResourceBudget,
  resolveCollectionBudget,
  resourceBudgetManifestToJson,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
} from '@night-watch/browser-sdk'
import { describe, expect, it, vi } from 'vitest'

type Opts = BuiltinSourceOptions

function slowSource(ms: number, value: unknown = 'ok'): Source<Opts, unknown> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(value), ms)
    })
}

function minimalSources(
  extras: Record<string, Source<Opts, unknown>> = {},
): BuiltinSources {
  return {
    platform: () => 'TestPlatform',
    ...extras,
  } as unknown as BuiltinSources
}

describe('resolveCollectionBudget', () => {
  it('requires a meaningful budget and validates timeouts', () => {
    expect(() => resolveCollectionBudget({})).toThrow(CollectionBudgetError)
    expect(() => resolveCollectionBudget({ totalTimeoutMs: 0 })).toThrow(CollectionBudgetError)
    expect(() => resolveCollectionBudget({ perSourceTimeoutMs: -1 })).toThrow(
      CollectionBudgetError,
    )

    const resolved = resolveCollectionBudget({
      totalTimeoutMs: 1000,
      perSourceTimeoutMs: 100,
      scheduling: 'idle',
    })
    expect(resolved.scheduling).toBe('idle')
    expect(resolved.idleYieldMs).toBe(16)

    const impact = describeBudgetImpact(resolved)
    expect(impact.manifest.revision).toBe(RESOURCE_BUDGETS_REVISION)
    expect(impact.mayAlterVisitorIdOnTimeoutOrAbort).toBe(true)
    expect(resourceBudgetManifestToJson(impact.manifest)).toContain('night-watch-resource-budgets-v1')
  })
})

describe('timer registry cleanup', () => {
  it('clears pending timers', async () => {
    const timers = createTimerRegistry()
    const spy = vi.fn()
    timers.schedule(spy, 50)
    expect(timers.pendingCount).toBe(1)
    timers.clearAll()
    expect(timers.pendingCount).toBe(0)
    await new Promise((r) => setTimeout(r, 80))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('loadWithResourceBudget vs default load', () => {
  it('default load is unchanged when budget API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).toEqual([...ENABLED_SOURCES])
  })

  it('successful budgeted run matches unbudgeted visitorId for the same sources', async () => {
    const sources = minimalSources({
      math: () => ({ acos: 1 }),
    })
    const baseline = await (
      await load({ delayFallback: 0, allowNonBrowser: true, sources })
    ).get()

    const { agent, dispose, getPendingTimerCount } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources,
      budget: { perSourceTimeoutMs: 5000, totalTimeoutMs: 10_000 },
    })
    const budgeted = await agent.get()
    expect(budgeted.visitorId).toBe(baseline.visitorId)
    expect(getPendingTimerCount()).toBe(0)
    dispose()
  })

  it('throws when aborted before collectors start', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      loadWithResourceBudget({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: minimalSources(),
        budget: { signal: controller.signal },
      }),
    ).rejects.toBeInstanceOf(CollectionAbortError)
  })

  it('per-source timeout becomes an error component — never a fake success', async () => {
    const { agent, getPendingTimerCount } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalSources({
        audio: slowSource(200, 42),
      }),
      budget: { perSourceTimeoutMs: 30 },
    })
    const result = await agent.get()
    expect(isErrorComponent(result.components.audio!)).toBe(true)
    if (isErrorComponent(result.components.audio!)) {
      expect(result.components.audio.error).toBeInstanceOf(SourceTimeoutError)
    }
    expect(isValueComponent(result.components.platform!)).toBe(true)
    expect(getPendingTimerCount()).toBe(0)
  })

  it('total budget aborts remaining work and clears timers', async () => {
    const started = Date.now()
    const { agent, getPendingTimerCount } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalSources({
        audio: slowSource(300, 'audio-late'),
        canvas: slowSource(300, 'canvas-late'),
      }),
      budget: { totalTimeoutMs: 40 },
    })
    const result = await agent.get()
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(250)
    expect(getPendingTimerCount()).toBe(0)

    const audio = result.components.audio!
    const canvas = result.components.canvas!
    // At least one slow source should be error (abort/timeout); never silent success values.
    const errors = [audio, canvas].filter(isErrorComponent)
    expect(errors.length).toBeGreaterThan(0)
    for (const component of [audio, canvas]) {
      if (isValueComponent(component)) {
        // If a value slipped through before abort, it must be the real value — not fabricated.
        expect(['audio-late', 'canvas-late', 'TestPlatform']).toContain(component.value)
      }
    }
  })

  it('external abort during slow audio-like source yields error component', async () => {
    const controller = new AbortController()
    const { agent } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalSources({
        audio: () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(99), 500)
          }),
      }),
      budget: { signal: controller.signal, perSourceTimeoutMs: 5000 },
    })

    const getPromise = agent.get()
    await new Promise((r) => setTimeout(r, 20))
    controller.abort()
    const result = await getPromise
    expect(isErrorComponent(result.components.audio!)).toBe(true)
    if (isErrorComponent(result.components.audio!)) {
      const err = result.components.audio.error as Error
      expect(err.name === 'AbortError' || err instanceof CollectionTimeoutError).toBe(true)
    }
  })

  it('two-stage source honors per-stage timeout on get', async () => {
    const { agent } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalSources({
        canvas: () => () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('late'), 200)
          }),
      }),
      budget: { perSourceTimeoutMs: 30 },
    })
    const result = await agent.get()
    expect(isErrorComponent(result.components.canvas!)).toBe(true)
    if (isErrorComponent(result.components.canvas!)) {
      expect(result.components.canvas.error).toBeInstanceOf(SourceTimeoutError)
      expect((result.components.canvas.error as SourceTimeoutError).stage).toBe('get')
    }
  })

  it('idle scheduling still collects successfully', async () => {
    const { agent } = await loadWithResourceBudget({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalSources({ math: () => ({ x: 1 }) }),
      budget: { scheduling: 'idle', idleYieldMs: 1, perSourceTimeoutMs: 2000 },
    })
    const result = await agent.get()
    expect(result.visitorId).toBe(hashComponents(result.components))
    expect(isValueComponent(result.components.math!)).toBe(true)
  })
})
