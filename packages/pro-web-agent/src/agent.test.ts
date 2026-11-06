import { describe, expect, it, vi } from 'vitest'
import { ENABLED_SOURCES, hashComponents, type UnknownComponents } from '@thenightwatch/core'
import { createProWebAgent, ProWebAgent, PRO_WEB_AGENT_PROTOCOL_VERSION } from './index.js'
import type { GetResult } from '@thenightwatch/browser-sdk'

function fakeResult(components: UnknownComponents): GetResult {
  const visitorId = hashComponents(components)
  return {
    visitorId,
    confidence: { score: 0.5 },
    components: components as GetResult['components'],
    version: '1.0.0',
  }
}

describe('ProWebAgent', () => {
  it('rejects unknown options and preserves 41 sources', async () => {
    expect(ProWebAgent.expectedSourceCount()).toBe(ENABLED_SOURCES.length)
    expect(ENABLED_SOURCES.length).toBe(41)
    expect(() => createProWebAgent({ weird: true } as never)).toThrow(/unknown option/)

    const components = { platform: { value: 'Win32' } } as UnknownComponents
    const get = vi.fn(async () => fakeResult(components))
    const agent = createProWebAgent({
      mode: 'off',
      loadFn: async () => ({ get }),
    })

    await agent.start()
    const a = await agent.get()
    const b = await agent.identify()
    expect(a.visitorId).toBe(b.visitorId)
    expect(a.visitorId).toBe(hashComponents(components))
    expect(a.networkAttempted).toBe(false)
    expect(a.protocolVersion).toBe(PRO_WEB_AGENT_PROTOCOL_VERSION)
    expect(agent.getVisitorData()?.visitorId).toBe(a.visitorId)

    agent.clearTransientState()
    expect(agent.getVisitorData()).toBeNull()
    agent.stop()
    await expect(agent.get()).rejects.toThrow(/stopped/)
  })

  it('single-flight and no network when browser_only', async () => {
    const components = { platform: { value: 'Linux' } } as UnknownComponents
    let calls = 0
    const get = vi.fn(async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 20))
      return fakeResult(components)
    })
    const fetchImpl = vi.fn()
    const agent = createProWebAgent({
      mode: 'browser_only',
      loadFn: async () => ({ get }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      telemetry: false,
    })
    await agent.start()
    const [x, y] = await Promise.all([agent.get(), agent.get()])
    expect(x.visitorId).toBe(y.visitorId)
    expect(calls).toBe(1)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(x.networkAttempted).toBe(false)
  })

  it('aborts via AbortSignal', async () => {
    const components = { platform: { value: 'Mac' } } as UnknownComponents
    const get = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return fakeResult(components)
    })
    const agent = createProWebAgent({
      mode: 'off',
      loadFn: async () => ({ get }),
    })
    await agent.start()
    const ctrl = new AbortController()
    const p = agent.get({ signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toThrow()
  })
})
