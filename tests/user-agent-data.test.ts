import {
  HighEntropyStatus,
  collectUserAgentData,
  componentsToCanonicalString,
  createBuiltinSources,
  hashComponents,
  isGreaseBrand,
  isValueComponent,
  load,
  type BuiltinComponents,
  type NavigatorUAData,
  type StableUserAgentData,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

function ua(partial: {
  brands: NavigatorUAData['brands']
  mobile?: boolean
  platform?: string
  getHighEntropyValues?: NavigatorUAData['getHighEntropyValues']
}): NavigatorUAData {
  return {
    brands: partial.brands,
    mobile: partial.mobile ?? false,
    platform: partial.platform ?? 'Windows',
    getHighEntropyValues: partial.getHighEntropyValues,
  }
}

describe('isGreaseBrand', () => {
  it('matches Chromium GREASE patterns', () => {
    expect(isGreaseBrand('Not_A Brand')).toBe(true)
    expect(isGreaseBrand('Not(A:Brand')).toBe(true)
    expect(isGreaseBrand(' Not;A Brand')).toBe(true)
    expect(isGreaseBrand('Google Chrome')).toBe(false)
    expect(isGreaseBrand('Chromium')).toBe(false)
  })
})

describe('collectUserAgentData', () => {
  it('returns undefined when UA-CH API is absent', async () => {
    expect(await collectUserAgentData(undefined)).toBeUndefined()
    expect(await collectUserAgentData(null)).toBeUndefined()
  })

  it('returns version-free brands without high-entropy when getter is absent', async () => {
    expect(
      await collectUserAgentData(
        ua({ brands: [{ brand: 'Google Chrome', version: '120' }] }),
      ),
    ).toEqual({
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Windows',
    })
  })

  it('filters GREASE brands', async () => {
    const result = await collectUserAgentData(
      ua({
        brands: [
          { brand: 'Not_A Brand', version: '99' },
          { brand: 'Not(A:Brand', version: '8' },
          { brand: ' Not;A Brand', version: '99' },
          { brand: 'Google Chrome', version: '120' },
        ],
      }),
    )
    expect(result?.brands).toEqual(['Google Chrome'])
  })

  it('removes Chromium when another brand remains; keeps Chromium alone', async () => {
    expect(
      (
        await collectUserAgentData(
          ua({
            brands: [
              { brand: 'Chromium', version: '120' },
              { brand: 'Google Chrome', version: '120' },
            ],
          }),
        )
      )?.brands,
    ).toEqual(['Google Chrome'])

    expect(
      (
        await collectUserAgentData(
          ua({ brands: [{ brand: 'Chromium', version: '120' }] }),
        )
      )?.brands,
    ).toEqual(['Chromium'])
  })

  it('includes high-entropy fields when permitted', async () => {
    const result = await collectUserAgentData(
      ua({
        brands: [{ brand: 'Google Chrome', version: '120' }],
        getHighEntropyValues: async () => ({
          architecture: 'x86',
          bitness: '64',
          model: '',
          platformVersion: '10.0.0',
        }),
      }),
    )
    expect(result).toEqual({
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Windows',
      architecture: 'x86',
      bitness: '64',
      model: '',
      platformVersion: '10.0.0',
    })
    expect(result && 'uaFullVersion' in result).toBe(false)
    expect(result?.highEntropyStatus).toBeUndefined()
  })

  it('sets highEntropyStatus not_allowed on Permissions Policy denial', async () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError')
    const result = await collectUserAgentData(
      ua({
        brands: [{ brand: 'Google Chrome', version: '120' }],
        platform: 'Linux',
        getHighEntropyValues: async () => {
          throw denied
        },
      }),
    )
    expect(result).toEqual({
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Linux',
      highEntropyStatus: HighEntropyStatus.NotAllowed,
    })
  })

  it('also accepts NotAllowedError without DOMException (Node fixtures)', async () => {
    const err = new Error('blocked')
    err.name = 'NotAllowedError'
    const result = await collectUserAgentData(
      ua({
        brands: [{ brand: 'Brave', version: '1' }],
        getHighEntropyValues: async () => {
          throw err
        },
      }),
    )
    expect(result?.highEntropyStatus).toBe('not_allowed')
  })

  it('re-throws unexpected high-entropy failures', async () => {
    const unexpected = new TypeError('Internal browser error')
    await expect(
      collectUserAgentData(
        ua({
          brands: [{ brand: 'Google Chrome', version: '120' }],
          getHighEntropyValues: async () => {
            throw unexpected
          },
        }),
      ),
    ).rejects.toBe(unexpected)
  })

  it('records mobile platforms', async () => {
    const result = await collectUserAgentData(
      ua({
        brands: [{ brand: 'Google Chrome', version: '120' }],
        mobile: true,
        platform: 'Android',
      }),
    )
    expect(result?.mobile).toBe(true)
    expect(result?.platform).toBe('Android')
  })

  it('is deterministic for identical snapshots', async () => {
    const snapshot = ua({
      brands: [
        { brand: 'Not_A Brand', version: '8' },
        { brand: 'Chromium', version: '120' },
        { brand: 'Google Chrome', version: '120' },
      ],
      getHighEntropyValues: async () => ({
        architecture: 'x86',
        bitness: '64',
        model: '',
        platformVersion: '15.0.0',
      }),
    })
    const a = await collectUserAgentData(snapshot)
    const b = await collectUserAgentData(snapshot)
    expect(a).toEqual(b)
  })

  it('hashes with stable key order in the component map (canonical sorted keys)', () => {
    const value: StableUserAgentData = {
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Windows',
      architecture: 'x86',
      bitness: '64',
      model: '',
      platformVersion: '10.0.0',
    }
    const components = {
      userAgentData: { value, duration: 1 },
      zzz: { value: 1, duration: 1 },
      aaa: { value: 2, duration: 1 },
    }
    const canonical = componentsToCanonicalString(components)
    expect(canonical.startsWith('aaa:')).toBe(true)
    expect(canonical).toContain('userAgentData:')
    expect(canonical.indexOf('aaa:')).toBeLessThan(canonical.indexOf('userAgentData:'))
    expect(hashComponents(components)).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('builtin registry wiring', () => {
  it('registers real userAgentData; yields undefined under Node (no UA-CH)', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[0]).toBe('userAgentData')

    const agent = await load({
      delayFallback: 0,
      sources,
      allowNonBrowser: true,
    })
    const result = await agent.get()
    expect(isValueComponent(result.components.userAgentData)).toBe(true)
    if (isValueComponent(result.components.userAgentData)) {
      expect(result.components.userAgentData.value).toBeUndefined()
    }
    // Absence serializes as JSON undefined → empty token after colon in practice via stringify
    const only = {
      userAgentData: result.components.userAgentData,
    } as BuiltinComponents
    expect(componentsToCanonicalString(only)).toBe('userAgentData:undefined')
  })
})
