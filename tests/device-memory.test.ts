import {
  componentsToCanonicalString,
  createBuiltinSources,
  getDeviceMemory,
  getDeviceMemoryValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readDeviceMemory,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('readDeviceMemory / getDeviceMemoryValue', () => {
  it('returns numeric deviceMemory buckets', () => {
    expect(readDeviceMemory({ deviceMemory: 8 })).toBe(8)
    expect(readDeviceMemory({ deviceMemory: 0.5 })).toBe(0.5)
    expect(getDeviceMemoryValue({ navigator: { deviceMemory: 4 } })).toBe(4)
  })

  it('converts numeric strings via toFloat', () => {
    expect(readDeviceMemory({ deviceMemory: '4' })).toBe(4)
    expect(readDeviceMemory({ deviceMemory: '8.0' })).toBe(8)
  })

  it('maps NaN / non-numeric strings to undefined (no RAM inventing)', () => {
    expect(readDeviceMemory({ deviceMemory: Number.NaN })).toBeUndefined()
    expect(readDeviceMemory({ deviceMemory: 'not-a-number' })).toBeUndefined()
    expect(readDeviceMemory({})).toBeUndefined()
    expect(readDeviceMemory(null)).toBeUndefined()
    expect(getDeviceMemoryValue()).toBeUndefined()
  })

  it('preserves Infinity (not NaN) without inventing a finite RAM size', () => {
    expect(readDeviceMemory({ deviceMemory: Number.POSITIVE_INFINITY })).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  it('preserves privacy-clamped bucket values as reported (no un-clamping)', () => {
    // Chromium exposes power-of-two buckets (e.g. 8 even when physical RAM is higher).
    expect(readDeviceMemory({ deviceMemory: 8 })).toBe(8)
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as { deviceMemory?: number }
    Object.defineProperty(hostile, 'deviceMemory', {
      get() {
        throw new Error('deviceMemory blocked')
      },
      configurable: true,
    })
    expect(() => getDeviceMemoryValue({ navigator: hostile })).toThrow('deviceMemory blocked')

    const source: Source<BuiltinSourceOptions, number | undefined> = () =>
      getDeviceMemoryValue({ navigator: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect((component.error as Error).message).toBe('deviceMemory blocked')
    }
  })
})

describe('builtin deviceMemory wiring', () => {
  it('wires deviceMemory as source #11; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[10]).toBe('deviceMemory')
    expect(sources.deviceMemory).toBe(getDeviceMemory)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.deviceMemory)).toBe(true)
    if (isValueComponent(result.components.deviceMemory)) {
      expect(result.components.deviceMemory.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        deviceMemory: { value: 8, duration: 1 },
      }),
    ).toContain('deviceMemory:')
    expect(
      hashComponents({
        deviceMemory: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
