import {
  componentsToCanonicalString,
  createBuiltinSources,
  getSessionStorage,
  getSessionStorageValue,
  hashComponents,
  isValueComponent,
  load,
  probeSessionStorage,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('probeSessionStorage / getSessionStorageValue', () => {
  it('returns true when sessionStorage object is present', () => {
    expect(
      probeSessionStorage({
        sessionStorage: {} as Storage,
      }),
    ).toBe(true)
    expect(
      getSessionStorageValue({
        window: { sessionStorage: {} as Storage },
      }),
    ).toBe(true)
  })

  it('returns false when missing or null (no inventing availability)', () => {
    expect(probeSessionStorage({})).toBe(false)
    expect(probeSessionStorage({ sessionStorage: null })).toBe(false)
    expect(probeSessionStorage(null)).toBe(false)
    expect(getSessionStorageValue({ window: null })).toBe(false)
    expect(getSessionStorageValue()).toBe(false)
  })

  it('SecurityError on getter → true (exists but blocked; no writes)', () => {
    const hostile = {} as WindowWithSessionStorageHostile
    Object.defineProperty(hostile, 'sessionStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
      configurable: true,
    })
    expect(probeSessionStorage(hostile)).toBe(true)
    expect(getSessionStorageValue({ window: hostile })).toBe(true)
  })

  it('does not call setItem/getItem (existence probe only)', () => {
    let touched = false
    const storage = {
      get length() {
        touched = true
        return 0
      },
      key() {
        touched = true
        return null
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
    } as Storage
    expect(probeSessionStorage({ sessionStorage: storage })).toBe(true)
    expect(touched).toBe(false)
  })
})

type WindowWithSessionStorageHostile = {
  sessionStorage?: Storage | null
}

describe('builtin sessionStorage wiring', () => {
  it('wires sessionStorage as source #15; Node yields false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[14]).toBe('sessionStorage')
    expect(sources.sessionStorage).toBe(getSessionStorage)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.sessionStorage)).toBe(true)
    if (isValueComponent(result.components.sessionStorage)) {
      expect(result.components.sessionStorage.value).toBe(false)
    }

    expect(
      componentsToCanonicalString({
        sessionStorage: { value: true, duration: 1 },
      }),
    ).toContain('sessionStorage:')
    expect(
      hashComponents({
        sessionStorage: { value: false, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
