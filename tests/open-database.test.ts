import {
  componentsToCanonicalString,
  createBuiltinSources,
  getOpenDatabase,
  getOpenDatabaseValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  probeOpenDatabase,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('probeOpenDatabase / getOpenDatabaseValue', () => {
  it('returns true when openDatabase function is present (old WebKit shape)', () => {
    let called = false
    const openDatabase = () => {
      called = true
    }
    expect(probeOpenDatabase({ openDatabase })).toBe(true)
    expect(getOpenDatabaseValue({ window: { openDatabase } })).toBe(true)
    expect(called).toBe(false)
  })

  it('returns false when feature removed / undefined / missing window', () => {
    expect(probeOpenDatabase({})).toBe(false)
    expect(probeOpenDatabase({ openDatabase: undefined })).toBe(false)
    expect(probeOpenDatabase({ openDatabase: null })).toBe(false)
    expect(probeOpenDatabase(null)).toBe(false)
    expect(getOpenDatabaseValue({ window: null })).toBe(false)
    expect(getOpenDatabaseValue()).toBe(false)
  })

  it('does not invoke openDatabase (no database creation)', () => {
    let called = false
    const openDatabase = (..._args: unknown[]) => {
      called = true
      return {}
    }
    expect(probeOpenDatabase({ openDatabase })).toBe(true)
    expect(called).toBe(false)
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile: { openDatabase?: unknown } = {}
    Object.defineProperty(hostile, 'openDatabase', {
      get() {
        throw new Error('openDatabase blocked')
      },
      configurable: true,
    })
    expect(() => getOpenDatabaseValue({ window: hostile })).toThrow('openDatabase blocked')

    const source: Source<BuiltinSourceOptions, boolean> = () =>
      getOpenDatabaseValue({ window: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin openDatabase wiring', () => {
  it('wires openDatabase as source #18; Node yields false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[17]).toBe('openDatabase')
    expect(sources.openDatabase).toBe(getOpenDatabase)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.openDatabase)).toBe(true)
    if (isValueComponent(result.components.openDatabase)) {
      expect(result.components.openDatabase.value).toBe(false)
    }

    expect(
      componentsToCanonicalString({
        openDatabase: { value: true, duration: 1 },
      }),
    ).toContain('openDatabase:')
    expect(
      hashComponents({
        openDatabase: { value: false, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
