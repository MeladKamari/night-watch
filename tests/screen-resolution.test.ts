import {
  componentsToCanonicalString,
  createBuiltinSources,
  getScreenResolution,
  getScreenResolutionValue,
  getUnstableScreenResolution,
  hashComponents,
  isValueComponent,
  load,
} from '@night-watch/browser-sdk'
import { toInt } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('toInt + getUnstableScreenResolution', () => {
  it('parses string/fractional dimensions and orders larger-first (orientation-independent)', () => {
    expect(toInt('1920')).toBe(1920)
    expect(toInt('1080.9')).toBe(1080)

    expect(
      getUnstableScreenResolution({
        screen: { width: 1080, height: 1920 },
      }),
    ).toEqual([1920, 1080])
    expect(
      getUnstableScreenResolution({
        screen: { width: 1920, height: 1080 },
      }),
    ).toEqual([1920, 1080])
  })

  it('handles string spoofed dimensions and missing → null (lexicographic sort+reverse)', () => {
    // Upstream uses default Array#sort (string compare) then reverse — not numeric max/min.
    expect(
      getUnstableScreenResolution({
        screen: { width: '1200', height: '800' },
      }),
    ).toEqual([800, 1200])
    expect(
      getUnstableScreenResolution({
        screen: { width: 'nope', height: 800 },
      }),
    ).toEqual([null, 800])
    expect(getUnstableScreenResolution({ screen: null })).toEqual([null, null])
    expect(getUnstableScreenResolution({ screen: {} })).toEqual([null, null])
  })

  it('Safari private skip returns undefined; otherwise returns pair', () => {
    expect(
      getScreenResolutionValue({
        screen: { width: 1920, height: 1080 },
        skipSafariPrivate: true,
      }),
    ).toBeUndefined()
    expect(
      getScreenResolutionValue({
        screen: { width: 1920, height: 1080 },
      }),
    ).toEqual([1920, 1080])
  })

  it('Node / missing screen yields [null, null] unstable; stabilized live path undefined under Node', () => {
    expect(getUnstableScreenResolution()).toEqual([null, null])
    expect(getScreenResolutionValue()).toEqual([null, null])
  })
})

describe('builtin screenResolution wiring', () => {
  it('wires screenResolution as source #12', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[11]).toBe('screenResolution')
    expect(sources.screenResolution).toBe(getScreenResolution)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.screenResolution)).toBe(true)
    if (isValueComponent(result.components.screenResolution)) {
      expect(result.components.screenResolution.value).toEqual([null, null])
    }

    expect(
      componentsToCanonicalString({
        screenResolution: { value: [1920, 1080], duration: 1 },
      }),
    ).toContain('screenResolution:')
    expect(
      hashComponents({
        screenResolution: { value: [1920, 1080], duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
