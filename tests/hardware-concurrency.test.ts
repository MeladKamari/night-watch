import {
  componentsToCanonicalString,
  createBuiltinSources,
  getHardwareConcurrency,
  getHardwareConcurrencyValue,
  getUnstableHardwareConcurrency,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readHardwareConcurrency,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readHardwareConcurrency / unstable', () => {
  it('parses 1/2/4/8/16 cores and numeric strings', () => {
    for (const n of [1, 2, 4, 8, 16] as const) {
      expect(readHardwareConcurrency({ hardwareConcurrency: n })).toBe(n)
      expect(getUnstableHardwareConcurrency({ navigator: { hardwareConcurrency: String(n) } })).toBe(
        n,
      )
    }
  })

  it('maps malformed / absent to undefined (no inventing cores)', () => {
    expect(readHardwareConcurrency({ hardwareConcurrency: 'nope' })).toBeUndefined()
    expect(readHardwareConcurrency({ hardwareConcurrency: Number.NaN })).toBeUndefined()
    expect(readHardwareConcurrency({})).toBeUndefined()
    expect(readHardwareConcurrency(null)).toBeUndefined()
    expect(getUnstableHardwareConcurrency()).toBeUndefined()
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as { hardwareConcurrency?: number }
    Object.defineProperty(hostile, 'hardwareConcurrency', {
      get() {
        throw new Error('hardwareConcurrency blocked')
      },
      configurable: true,
    })
    expect(() => getUnstableHardwareConcurrency({ navigator: hostile })).toThrow(
      'hardwareConcurrency blocked',
    )
    const source: Source<BuiltinSourceOptions, number | undefined> = () =>
      getUnstableHardwareConcurrency({ navigator: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('Firefox 143+ tiering', () => {
  it('tiers ≤4→4 and ≥8→8 when applyFirefoxTiering; unstable stays raw', () => {
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 1 },
        applyFirefoxTiering: true,
      }),
    ).toBe(4)
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 2 },
        applyFirefoxTiering: true,
      }),
    ).toBe(4)
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 4 },
        applyFirefoxTiering: true,
      }),
    ).toBe(4)
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 8 },
        applyFirefoxTiering: true,
      }),
    ).toBe(8)
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 16 },
        applyFirefoxTiering: true,
      }),
    ).toBe(8)
    expect(
      getUnstableHardwareConcurrency({
        navigator: { hardwareConcurrency: 16 },
      }),
    ).toBe(16)
    expect(
      getHardwareConcurrencyValue({
        navigator: { hardwareConcurrency: 16 },
      }),
    ).toBe(16)
  })
})

describe('builtin hardwareConcurrency wiring', () => {
  it('wires hardwareConcurrency as source #13; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[12]).toBe('hardwareConcurrency')
    expect(sources.hardwareConcurrency).toBe(getHardwareConcurrency)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.hardwareConcurrency)).toBe(true)
    if (isValueComponent(result.components.hardwareConcurrency)) {
      expect(result.components.hardwareConcurrency.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        hardwareConcurrency: { value: 8, duration: 1 },
      }),
    ).toContain('hardwareConcurrency:')
    expect(
      hashComponents({
        hardwareConcurrency: { value: 4, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
