import {
  componentsToCanonicalString,
  createBuiltinSources,
  getOsCpu,
  getOsCpuValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readOsCpu,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('readOsCpu / getOsCpuValue', () => {
  it('returns Firefox-like oscpu string when present', () => {
    expect(readOsCpu({ oscpu: 'Windows NT 10.0; Win64; x64' })).toBe(
      'Windows NT 10.0; Win64; x64',
    )
    expect(getOsCpuValue({ navigator: { oscpu: 'Linux x86_64' } })).toBe('Linux x86_64')
  })

  it('returns undefined when oscpu is absent (Chromium/Safari shape)', () => {
    expect(readOsCpu({})).toBeUndefined()
    expect(getOsCpuValue({ navigator: {} })).toBeUndefined()
    expect(getOsCpuValue({ navigator: null })).toBeUndefined()
  })

  it('does not invent a CPU string under Node (no navigator access)', () => {
    expect(getOsCpuValue()).toBeUndefined()
  })

  it('surfaces getter throws to the caller / loadSource error path', async () => {
    const hostile = {} as { oscpu?: string }
    Object.defineProperty(hostile, 'oscpu', {
      get() {
        throw new Error('oscpu blocked')
      },
      configurable: true,
    })
    expect(() => getOsCpuValue({ navigator: hostile })).toThrow('oscpu blocked')

    const source: Source<BuiltinSourceOptions, string | undefined> = () =>
      getOsCpuValue({ navigator: hostile })
    const get = loadSource(source, { cache: {} })
    const component = await get()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect((component.error as Error).message).toBe('oscpu blocked')
    }
  })
})

describe('builtin osCpu wiring', () => {
  it('wires osCpu as source #8; Node yields undefined value', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[7]).toBe('osCpu')
    expect(sources.osCpu).toBe(getOsCpu)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.osCpu)).toBe(true)
    if (isValueComponent(result.components.osCpu)) {
      expect(result.components.osCpu.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        osCpu: { value: 'Windows NT 10.0; Win64; x64', duration: 1 },
      }),
    ).toContain('osCpu:')
    expect(
      hashComponents({
        osCpu: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
