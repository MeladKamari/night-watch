import {
  NAMESPACED_ID_ALGORITHM,
  IdentityScopeError,
  applyIdentityScope,
  createBuiltinSources,
  deriveVisitorIds,
  hashComponents,
  hashComponentsNamespaced,
  load,
  loadWithIdentityScope,
  type UnknownComponents,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

function sampleComponents(): UnknownComponents {
  return {
    platform: { value: 'Win32', duration: 1 },
    math: { value: { acos: 1.2 }, duration: 1 },
    timezone: { value: 'UTC', duration: 1 },
  }
}

describe('namespaced identity (opt-in)', () => {
  it('rejects empty namespace', () => {
    expect(() =>
      hashComponentsNamespaced(sampleComponents(), { namespace: '   ' }),
    ).toThrow(IdentityScopeError)
  })

  it('default hashComponents remains unsalted and differs from namespaced', () => {
    const components = sampleComponents()
    const baseline = hashComponents(components)
    const namespaced = hashComponentsNamespaced(components, {
      namespace: 'shop-a',
      salt: 's1',
      domain: 'example.test',
    })
    expect(baseline).toMatch(/^[0-9a-f]{32}$/)
    expect(namespaced).toMatch(/^[0-9a-f]{32}$/)
    expect(namespaced).not.toBe(baseline)
  })

  it('namespaces separate the same browser entropy', () => {
    const components = sampleComponents()
    const a = hashComponentsNamespaced(components, { namespace: 'app-a', salt: 'shared' })
    const b = hashComponentsNamespaced(components, { namespace: 'app-b', salt: 'shared' })
    expect(a).not.toBe(b)
  })

  it('is stable within the same scope', () => {
    const components = sampleComponents()
    const scope = { namespace: 'app', salt: 'stable-salt', domain: 'a.example' }
    expect(hashComponentsNamespaced(components, scope)).toBe(
      hashComponentsNamespaced(components, scope),
    )
  })

  it('domain separation changes the id', () => {
    const components = sampleComponents()
    const left = hashComponentsNamespaced(components, {
      namespace: 'app',
      salt: 's',
      domain: 'site-one',
    })
    const right = hashComponentsNamespaced(components, {
      namespace: 'app',
      salt: 's',
      domain: 'site-two',
    })
    expect(left).not.toBe(right)
  })

  it('salt rotation changes the id; old salt remains reproducible', () => {
    const components = sampleComponents()
    const oldSalt = hashComponentsNamespaced(components, { namespace: 'app', salt: 'v1' })
    const newSalt = hashComponentsNamespaced(components, { namespace: 'app', salt: 'v2' })
    expect(oldSalt).not.toBe(newSalt)
    expect(hashComponentsNamespaced(components, { namespace: 'app', salt: 'v1' })).toBe(oldSalt)
  })

  it('deriveVisitorIds marks upstreamCompatible false and never echoes salt', () => {
    const derived = deriveVisitorIds(sampleComponents(), {
      namespace: 'app',
      salt: 'super-secret',
      domain: 'x',
    })
    expect(derived.identity.algorithm).toBe(NAMESPACED_ID_ALGORITHM)
    expect(derived.identity.upstreamCompatible).toBe(false)
    expect(derived.identity.hasSalt).toBe(true)
    expect(JSON.stringify(derived)).not.toContain('super-secret')
    expect(derived.visitorId).not.toBe(derived.baselineVisitorId)
  })

  it('applyIdentityScope wraps GetResult without mutating baseline load path', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const baseline = await agent.get()
    const scoped = applyIdentityScope(baseline, { namespace: 'playground', domain: 'local' })
    expect(scoped.baselineVisitorId).toBe(baseline.visitorId)
    expect(scoped.visitorId).not.toBe(baseline.visitorId)
    expect(scoped.identity.upstreamCompatible).toBe(false)
    // Original result unchanged
    expect(baseline.visitorId).toBe(hashComponents(baseline.components))
  })

  it('loadWithIdentityScope get() returns namespaced id; baselineAgent stays unsalted', async () => {
    const { agent, baselineAgent, identity } = await loadWithIdentityScope({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
      identity: { namespace: 'tenant-1', salt: 'rot-a' },
    })
    expect(identity.hasSalt).toBe(true)
    expect(identity.upstreamCompatible).toBe(false)

    const scoped = await agent.get()
    const raw = await baselineAgent.get()
    expect(scoped.visitorId).not.toBe(raw.visitorId)
    expect(scoped.baselineVisitorId).toBe(raw.visitorId)
    expect(Object.keys(scoped.components)).toHaveLength(41)
    expect(scoped.components).not.toHaveProperty('applePay')
  })
})
