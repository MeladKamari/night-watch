import {
  VENDOR_FLAVOR_KEYS,
  collectVendorFlavors,
  componentsToCanonicalString,
  createBuiltinSources,
  getVendorFlavors,
  getVendorFlavorsValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('collectVendorFlavors / getVendorFlavorsValue', () => {
  it('returns sorted names of allowlisted truthy object globals only', () => {
    expect(
      collectVendorFlavors({
        safari: { pushNotification: {} },
        chrome: { runtime: {} },
        yandex: { something: 1 },
      }),
    ).toEqual(['chrome', 'safari', 'yandex'])
  })

  it('ignores non-object / falsy / null properties (false positives)', () => {
    expect(
      collectVendorFlavors({
        chrome: true,
        safari: 'yes',
        yandex: 1,
        __firefox__: null,
        oprt: undefined,
        webkit: false,
        samsungAr: {},
      }),
    ).toEqual(['samsungAr'])
  })

  it('ignores non-allowlisted object globals', () => {
    expect(
      collectVendorFlavors({
        fakeBrowser: { x: 1 },
        chrome: { a: 1 },
      }),
    ).toEqual(['chrome'])
  })

  it('missing / null window → empty array', () => {
    expect(collectVendorFlavors(null)).toEqual([])
    expect(collectVendorFlavors(undefined)).toEqual([])
    expect(getVendorFlavorsValue({ window: null })).toEqual([])
    expect(getVendorFlavorsValue()).toEqual([])
  })

  it('does not invoke methods on matched vendor objects', () => {
    let called = false
    const chrome = {
      runtime: {
        sendMessage() {
          called = true
        },
      },
      get getVersion() {
        called = true
        return '1'
      },
    }
    collectVendorFlavors({ chrome })
    expect(called).toBe(false)
  })

  it('repeated runs are deterministic', () => {
    const win = { chrome: { a: 1 }, safari: { b: 2 } }
    expect(getVendorFlavorsValue({ window: win })).toEqual(
      getVendorFlavorsValue({ window: win }),
    )
    expect(getVendorFlavorsValue({ window: win })).toEqual(['chrome', 'safari'])
  })

  it('allowlist stays locked to upstream key set', () => {
    expect([...VENDOR_FLAVOR_KEYS]).toEqual([
      'chrome',
      'safari',
      '__crWeb',
      '__gCrWeb',
      'yandex',
      '__yb',
      '__ybro',
      '__firefox__',
      '__edgeTrackingPreventionStatistics',
      'webkit',
      'oprt',
      'samsungAr',
      'ucweb',
      'UCShellJava',
      'puffinDevice',
    ])
  })

  it('surfaces property getter throws to loadSource error path', async () => {
    const hostile = {} as Record<string, unknown>
    Object.defineProperty(hostile, 'chrome', {
      get() {
        throw new Error('flavor blocked')
      },
      configurable: true,
    })
    expect(() => getVendorFlavorsValue({ window: hostile })).toThrow('flavor blocked')

    const source: Source<BuiltinSourceOptions, string[]> = () =>
      getVendorFlavorsValue({ window: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin vendorFlavors wiring', () => {
  it('wires vendorFlavors as source #24; Node yields []', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[23]).toBe('vendorFlavors')
    expect(sources.vendorFlavors).toBe(getVendorFlavors)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.vendorFlavors)).toBe(true)
    if (isValueComponent(result.components.vendorFlavors)) {
      expect(result.components.vendorFlavors.value).toEqual([])
    }

    expect(
      componentsToCanonicalString({
        vendorFlavors: { value: ['chrome'], duration: 1 },
      }),
    ).toContain('vendorFlavors:')
    expect(
      hashComponents({
        vendorFlavors: { value: [], duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
