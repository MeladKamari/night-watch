import {
  componentsToCanonicalString,
  createBuiltinSources,
  getLocalStorage,
  getLocalStorageValue,
  hashComponents,
  isValueComponent,
  load,
  probeLocalStorage,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('probeLocalStorage / getLocalStorageValue', () => {
  it('returns true when localStorage object is present', () => {
    expect(probeLocalStorage({ localStorage: {} as Storage })).toBe(true)
    expect(getLocalStorageValue({ window: { localStorage: {} as Storage } })).toBe(true)
  })

  it('returns false when missing or null (disabled / absent)', () => {
    expect(probeLocalStorage({})).toBe(false)
    expect(probeLocalStorage({ localStorage: null })).toBe(false)
    expect(probeLocalStorage(null)).toBe(false)
    expect(getLocalStorageValue({ window: null })).toBe(false)
    expect(getLocalStorageValue()).toBe(false)
  })

  it('SecurityError on getter → true (exists but blocked; no mutation)', () => {
    const hostile: { localStorage?: Storage } = {}
    Object.defineProperty(hostile, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
      configurable: true,
    })
    expect(probeLocalStorage(hostile)).toBe(true)
  })

  it('does not call setItem/getItem (existence probe only)', () => {
    let touched = false
    const storage = {
      get length() {
        touched = true
        return 0
      },
      getItem() {
        touched = true
        return null
      },
      setItem() {
        touched = true
      },
      removeItem() {
        touched = true
      },
      clear() {
        touched = true
      },
      key() {
        touched = true
        return null
      },
    } as Storage
    expect(probeLocalStorage({ localStorage: storage })).toBe(true)
    expect(touched).toBe(false)
  })
})

describe('builtin localStorage wiring', () => {
  it('wires localStorage as source #16; Node yields false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[15]).toBe('localStorage')
    expect(sources.localStorage).toBe(getLocalStorage)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.localStorage)).toBe(true)
    if (isValueComponent(result.components.localStorage)) {
      expect(result.components.localStorage.value).toBe(false)
    }

    expect(
      componentsToCanonicalString({
        localStorage: { value: true, duration: 1 },
      }),
    ).toContain('localStorage:')
    expect(
      hashComponents({
        localStorage: { value: false, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
