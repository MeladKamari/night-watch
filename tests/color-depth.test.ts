import {
  componentsToCanonicalString,
  createBuiltinSources,
  getColorDepth,
  getColorDepthValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readColorDepth,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readColorDepth / getColorDepthValue', () => {
  it('returns reported integer depths including zero', () => {
    expect(readColorDepth({ colorDepth: 24 })).toBe(24)
    expect(readColorDepth({ colorDepth: 30 })).toBe(30)
    expect(readColorDepth({ colorDepth: 0 })).toBe(0)
    expect(getColorDepthValue({ screen: { colorDepth: 32 } })).toBe(32)
  })

  it('preserves NaN and non-integer values (no pixel-format guessing)', () => {
    expect(Number.isNaN(readColorDepth({ colorDepth: Number.NaN }))).toBe(true)
    expect(readColorDepth({ colorDepth: 24.5 })).toBe(24.5)
  })

  it('returns undefined when screen or colorDepth is missing (never invents 24)', () => {
    expect(readColorDepth(null)).toBeUndefined()
    expect(readColorDepth(undefined)).toBeUndefined()
    expect(readColorDepth({})).toBeUndefined()
    expect(getColorDepthValue({ screen: null })).toBeUndefined()
    expect(getColorDepthValue()).toBeUndefined()
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as { colorDepth?: number }
    Object.defineProperty(hostile, 'colorDepth', {
      get() {
        throw new Error('colorDepth blocked')
      },
      configurable: true,
    })
    expect(() => getColorDepthValue({ screen: hostile })).toThrow('colorDepth blocked')

    const source: Source<BuiltinSourceOptions, number | undefined> = () =>
      getColorDepthValue({ screen: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect((component.error as Error).message).toBe('colorDepth blocked')
    }
  })
})

describe('builtin colorDepth wiring', () => {
  it('wires colorDepth as source #10; Node yields undefined value', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[9]).toBe('colorDepth')
    expect(sources.colorDepth).toBe(getColorDepth)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.colorDepth)).toBe(true)
    if (isValueComponent(result.components.colorDepth)) {
      expect(result.components.colorDepth.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        colorDepth: { value: 24, duration: 1 },
      }),
    ).toContain('colorDepth:')
    expect(
      hashComponents({
        colorDepth: { value: 0, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
