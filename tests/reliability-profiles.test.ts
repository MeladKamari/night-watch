import {
  ENABLED_SOURCE_COUNT,
  ENABLED_SOURCES,
  RELIABILITY_PROFILES_REVISION,
  RELIABILITY_PROFILE_IDS,
  SOURCE_RELIABILITY_TIERS,
  assertProfileMath,
  assertReliabilityProfileId,
  assertReliabilityTierCoverage,
  createBuiltinSources,
  getReliabilityProfileManifest,
  hashComponents,
  listAllReliabilityProfileManifests,
  listReliabilityRows,
  load,
  loadWithReliabilityProfile,
  reliabilityProfileManifestToJson,
  resolveReliabilityProfile,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
} from '@night-watch/browser-sdk'
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

describe('reliability profile catalog', () => {
  it('covers every enabled source with a tier and never applePay', () => {
    expect(() => assertReliabilityTierCoverage()).not.toThrow()
    expect(() => assertProfileMath()).not.toThrow()
    expect(Object.keys(SOURCE_RELIABILITY_TIERS)).toHaveLength(ENABLED_SOURCE_COUNT)
    expect(listReliabilityRows()).toHaveLength(41)
    expect(Object.keys(SOURCE_RELIABILITY_TIERS)).not.toContain('applePay')
    for (const source of ENABLED_SOURCES) {
      expect(SOURCE_RELIABILITY_TIERS[source]).toMatch(/^(stable|moderate|volatile)$/)
    }
  })

  it('exposes versioned revision and three profile ids', () => {
    expect(RELIABILITY_PROFILES_REVISION).toBe('night-watch-reliability-profiles-v1')
    expect([...RELIABILITY_PROFILE_IDS]).toEqual([
      'conservative',
      'balanced',
      'diagnostic',
    ])
  })

  it('rejects unknown profile ids', () => {
    expect(() => assertReliabilityProfileId('aggressive')).toThrow(TypeError)
    expect(() => assertReliabilityProfileId('conservative')).not.toThrow()
  })
})

describe('diffable manifests', () => {
  it('builds deterministic JSON and stable inclusion math', () => {
    const manifests = listAllReliabilityProfileManifests()
    expect(manifests).toHaveLength(3)

    const conservative = getReliabilityProfileManifest('conservative')
    const balanced = getReliabilityProfileManifest('balanced')
    const diagnostic = getReliabilityProfileManifest('diagnostic')

    expect(conservative.revision).toBe(RELIABILITY_PROFILES_REVISION)
    expect(conservative.includedCount + conservative.excludedCount).toBe(41)
    expect(conservative.includedSources.every((s) => SOURCE_RELIABILITY_TIERS[s] === 'stable')).toBe(
      true,
    )
    expect(conservative.excludedSources).toContain('canvas')
    expect(conservative.excludedSources).toContain('audio')
    expect(conservative.excludedSources).toContain('webGlBasics')
    expect(conservative.excludedCount).toBeGreaterThan(0)

    expect(balanced.includedSources).toEqual(
      expect.arrayContaining([...conservative.includedSources]),
    )
    expect(balanced.excludedSources.every((s) => SOURCE_RELIABILITY_TIERS[s] === 'volatile')).toBe(
      true,
    )
    expect(balanced.excludedCount).toBeGreaterThan(0)

    expect(diagnostic.includedCount).toBe(41)
    expect(diagnostic.excludedCount).toBe(0)
    expect(diagnostic.includedSources).toEqual([...ENABLED_SOURCES])

    const jsonA = reliabilityProfileManifestToJson(conservative)
    const jsonB = reliabilityProfileManifestToJson(getReliabilityProfileManifest('conservative'))
    expect(jsonA).toBe(jsonB)
    expect(jsonA).toContain('"profileId": "conservative"')
    expect(jsonA).toContain('"revision": "night-watch-reliability-profiles-v1"')
  })

  it('resolveReliabilityProfile flags visitorId impact correctly', () => {
    expect(resolveReliabilityProfile('conservative').visitorIdWillDifferFromFullDefault).toBe(true)
    expect(resolveReliabilityProfile('balanced').visitorIdWillDifferFromFullDefault).toBe(true)
    expect(resolveReliabilityProfile('diagnostic').visitorIdWillDifferFromFullDefault).toBe(false)
  })
})

describe('loadWithReliabilityProfile vs default load', () => {
  it('default load is unchanged (41 keys) when profile API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).toEqual([...ENABLED_SOURCES])
  })

  it('diagnostic matches default visitorId; conservative differs and skips volatile collectors', async () => {
    const { sources, runCounts } = instrumentedSources()

    const fullAgent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources,
    })
    const full = await fullAgent.get()

    const { agent: diagAgent, resolution: diagRes } = await loadWithReliabilityProfile({
      delayFallback: 0,
      allowNonBrowser: true,
      sources,
      profile: 'diagnostic',
    })
    const diagnostic = await diagAgent.get()
    expect(diagRes.visitorIdWillDifferFromFullDefault).toBe(false)
    expect(Object.keys(diagnostic.components)).toHaveLength(41)
    expect(diagnostic.visitorId).toBe(full.visitorId)

    runCounts.clear()
    const { agent: consAgent, resolution: consRes } = await loadWithReliabilityProfile({
      delayFallback: 0,
      allowNonBrowser: true,
      sources,
      profile: 'conservative',
    })
    const conservative = await consAgent.get()
    expect(consRes.visitorIdWillDifferFromFullDefault).toBe(true)
    expect(Object.keys(conservative.components)).toHaveLength(consRes.manifest.includedCount)
    expect(conservative.visitorId).not.toBe(full.visitorId)
    expect(conservative.components).not.toHaveProperty('canvas')
    expect(conservative.components).not.toHaveProperty('audio')
    expect(runCounts.has('canvas')).toBe(false)
    expect(runCounts.has('audio')).toBe(false)
    expect(runCounts.has('platform')).toBe(true)

    const { agent: balAgent, resolution: balRes } = await loadWithReliabilityProfile({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
      profile: 'balanced',
    })
    const balanced = await balAgent.get()
    expect(balRes.visitorIdWillDifferFromFullDefault).toBe(true)
    expect(Object.keys(balanced.components)).toHaveLength(balRes.manifest.includedCount)
    expect(balanced.visitorId).not.toBe(full.visitorId)
    expect(balanced.visitorId).not.toBe(conservative.visitorId)
    expect(balanced.components).not.toHaveProperty('canvas')
    expect(balanced.components).toHaveProperty('languages')
  })

  it('profile change alters hash only when exclusions differ', async () => {
    const sources = createBuiltinSources()
    const a = await (
      await loadWithReliabilityProfile({
        delayFallback: 0,
        allowNonBrowser: true,
        sources,
        profile: 'conservative',
      })
    ).agent.get()
    const b = await (
      await loadWithReliabilityProfile({
        delayFallback: 0,
        allowNonBrowser: true,
        sources,
        profile: 'conservative',
      })
    ).agent.get()
    expect(a.visitorId).toBe(b.visitorId)

    const c = await (
      await loadWithReliabilityProfile({
        delayFallback: 0,
        allowNonBrowser: true,
        sources,
        profile: 'balanced',
      })
    ).agent.get()
    expect(c.visitorId).not.toBe(a.visitorId)

    // Same components → same hashComponents (serialization stability)
    expect(hashComponents(a.components)).toBe(a.visitorId)
  })

  it('never registers applePay under any profile', async () => {
    for (const profile of RELIABILITY_PROFILE_IDS) {
      const { agent, resolution } = await loadWithReliabilityProfile({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: createBuiltinSources(),
        profile,
      })
      const result = await agent.get()
      expect(Object.keys(result.components)).not.toContain('applePay')
      expect(resolution.manifest.includedSources).not.toContain('applePay')
      expect(resolution.manifest.excludedSources).not.toContain('applePay')
    }
  })
})
