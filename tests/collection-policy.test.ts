import {
  ENABLED_SOURCE_COUNT,
  ENABLED_SOURCES,
  CollectionConsentError,
  SOURCE_CATEGORIES,
  assertCategoryCoverage,
  createBuiltinSources,
  describePolicyImpact,
  hashComponents,
  isConsentAllowingCollection,
  load,
  loadWithCollectionPolicy,
  resolveExcludedSources,
  sourcesInCategories,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

type Opts = BuiltinSourceOptions

function instrumentedSources(): {
  sources: BuiltinSources
  runCounts: Map<string, number>
} {
  const runCounts = new Map<string, number>()
  const base = createBuiltinSources()
  const sources = {} as BuiltinSources
  for (const key of Object.keys(base) as (keyof BuiltinSources)[]) {
    const original = base[key] as Source<Opts, unknown>
    sources[key] = ((options: Opts) => {
      runCounts.set(key, (runCounts.get(key) ?? 0) + 1)
      return typeof original === 'function' ? original(options) : original
    }) as BuiltinSources[typeof key]
  }
  return { sources, runCounts }
}

describe('collection policy categories', () => {
  it('covers all 41 sources exactly once without applePay', () => {
    expect(() => assertCategoryCoverage()).not.toThrow()
    expect(SOURCE_CATEGORIES.length).toBeGreaterThan(0)
    const flat = SOURCE_CATEGORIES.flatMap((c) => sourcesInCategories([c]))
    expect(new Set(flat).size).toBe(41)
    expect(flat).not.toContain('applePay')
  })
})

describe('resolveExcludedSources / describePolicyImpact', () => {
  it('omits a category and documents visitorId impact', () => {
    const policy = {
      consent: { status: 'granted' as const, purpose: 'abuse-prevention-demo' },
      omitCategories: ['audio' as const],
    }
    const excluded = resolveExcludedSources(policy)
    expect(excluded).toEqual(['audio', 'audioBaseLatency'])
    const impact = describePolicyImpact(policy)
    expect(impact.visitorIdWillDifferFromFullDefault).toBe(true)
    expect(impact.includedSourceCount).toBe(ENABLED_SOURCE_COUNT - 2)
    expect(impact.notes.some((n) => /changes visitorId/i.test(n))).toBe(true)
  })

  it('allowCategories intersects omit lists', () => {
    const excluded = resolveExcludedSources({
      consent: { status: 'granted' },
      allowCategories: ['math', 'locale'],
      omitSources: ['timezone'],
    })
    expect(excluded).toContain('canvas')
    expect(excluded).toContain('timezone')
    expect(excluded).not.toContain('math')
    expect(excluded).not.toContain('languages')
    expect(excluded).not.toContain('dateTimeLocale')
  })
})

describe('consent gating', () => {
  it('recognizes allowing vs blocking statuses', () => {
    expect(isConsentAllowingCollection('granted')).toBe(true)
    expect(isConsentAllowingCollection('not_required')).toBe(true)
    expect(isConsentAllowingCollection('denied')).toBe(false)
    expect(isConsentAllowingCollection('withdrawn')).toBe(false)
  })

  it('refuses collection when consent denied — collectors never run', async () => {
    const { sources, runCounts } = instrumentedSources()
    await expect(
      loadWithCollectionPolicy({
        delayFallback: 0,
        allowNonBrowser: true,
        sources,
        policy: { consent: { status: 'denied' } },
      }),
    ).rejects.toBeInstanceOf(CollectionConsentError)
    expect(runCounts.size).toBe(0)
  })

  it('refuses collection when consent withdrawn', async () => {
    await expect(
      loadWithCollectionPolicy({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: createBuiltinSources(),
        policy: { consent: { status: 'withdrawn' } },
      }),
    ).rejects.toMatchObject({ name: 'CollectionConsentError', status: 'withdrawn' })
  })
})

describe('loadWithCollectionPolicy vs default load', () => {
  it('default load is unchanged (41 keys) when policy API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).toEqual([...ENABLED_SOURCES])
  })

  it('omitted category collectors never run; visitorId differs from full set', async () => {
    const { sources, runCounts } = instrumentedSources()
    const full = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const fullResult = await full.get()

    const { agent, resolution } = await loadWithCollectionPolicy({
      delayFallback: 0,
      allowNonBrowser: true,
      sources,
      policy: {
        consent: { status: 'granted', noticeVersion: 'notice-v1' },
        omitCategories: ['rendering'],
      },
    })
    const partial = await agent.get()

    expect(resolution.excludedSources).toEqual(
      expect.arrayContaining([
        'fonts',
        'domBlockers',
        'fontPreferences',
        'canvas',
        'webGlBasics',
        'webGlExtensions',
      ]),
    )
    expect(Object.keys(partial.components)).toHaveLength(41 - resolution.excludedSources.length)
    expect(partial.components).not.toHaveProperty('canvas')
    expect(runCounts.get('canvas') ?? 0).toBe(0)
    expect(runCounts.get('fonts') ?? 0).toBe(0)
    expect(runCounts.get('math')).toBeGreaterThan(0)

    expect(partial.visitorId).not.toBe(fullResult.visitorId)
    expect(partial.visitorId).toBe(hashComponents(partial.components))
    expect(resolution.visitorIdWillDifferFromFullDefault).toBe(true)
    expect(resolution.noticeVersion).toBe('notice-v1')
  })

  it('rejects unknown category names', async () => {
    await expect(
      loadWithCollectionPolicy({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: createBuiltinSources(),
        policy: {
          consent: { status: 'granted' },
          omitCategories: ['notARealCategory' as 'math'],
        },
      }),
    ).rejects.toBeInstanceOf(TypeError)
  })
})
