import {
  componentsToCanonicalString,
  createBuiltinSources,
  getIndexedDB,
  getIndexedDBValue,
  hashComponents,
  isValueComponent,
  load,
  probeIndexedDB,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('probeIndexedDB / getIndexedDBValue', () => {
  it('returns true when indexedDB is present (no open/write)', () => {
    let opened = false
    const factory = {
      open() {
        opened = true
        return {} as IDBOpenDBRequest
      },
    } as unknown as IDBFactory
    expect(probeIndexedDB({ indexedDB: factory })).toBe(true)
    expect(opened).toBe(false)
    expect(getIndexedDBValue({ window: { indexedDB: factory } })).toBe(true)
  })

  it('returns false when missing or null', () => {
    expect(probeIndexedDB({})).toBe(false)
    expect(probeIndexedDB({ indexedDB: null })).toBe(false)
    expect(probeIndexedDB(null)).toBe(false)
    expect(getIndexedDBValue({ window: null })).toBe(false)
    expect(getIndexedDBValue()).toBe(false)
  })

  it('SecurityError / blocked getter → true (API present but restricted)', () => {
    const hostile: { indexedDB?: IDBFactory } = {}
    Object.defineProperty(hostile, 'indexedDB', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
      configurable: true,
    })
    expect(probeIndexedDB(hostile)).toBe(true)
  })

  it('IE/EdgeHTML skip returns undefined (private-mode stabilization)', () => {
    expect(
      getIndexedDBValue({
        window: { indexedDB: {} as IDBFactory },
        skipLegacyIE: true,
      }),
    ).toBeUndefined()
    expect(
      getIndexedDBValue({
        window: { indexedDB: {} as IDBFactory },
        skipLegacyIE: false,
      }),
    ).toBe(true)
  })
})

describe('builtin indexedDB wiring', () => {
  it('wires indexedDB as source #17; Node yields false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[16]).toBe('indexedDB')
    expect(sources.indexedDB).toBe(getIndexedDB)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.indexedDB)).toBe(true)
    if (isValueComponent(result.components.indexedDB)) {
      expect(result.components.indexedDB.value).toBe(false)
    }

    expect(
      componentsToCanonicalString({
        indexedDB: { value: true, duration: 1 },
      }),
    ).toContain('indexedDB:')
    expect(
      hashComponents({
        indexedDB: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
