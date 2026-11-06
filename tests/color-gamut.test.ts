import {
  COLOR_GAMUT_ORDER,
  componentsToCanonicalString,
  createBuiltinSources,
  detectColorGamut,
  getColorGamut,
  getColorGamutValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  type MatchMediaLike,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

function makeMatchMedia(matching: ReadonlySet<string> | ((query: string) => boolean)): MatchMediaLike {
  return (query: string) => ({
    matches:
      typeof matching === 'function'
        ? matching(query)
        : matching.has(query),
  })
}

describe('detectColorGamut / getColorGamutValue', () => {
  it('probes rec2020 → p3 → srgb (widest first)', () => {
    expect([...COLOR_GAMUT_ORDER]).toEqual(['rec2020', 'p3', 'srgb'])

    expect(
      detectColorGamut(
        makeMatchMedia(
          new Set([
            '(color-gamut: rec2020)',
            '(color-gamut: p3)',
            '(color-gamut: srgb)',
          ]),
        ),
      ),
    ).toBe('rec2020')

    expect(
      detectColorGamut(
        makeMatchMedia(new Set(['(color-gamut: p3)', '(color-gamut: srgb)'])),
      ),
    ).toBe('p3')

    expect(detectColorGamut(makeMatchMedia(new Set(['(color-gamut: srgb)'])))).toBe('srgb')
  })

  it('wide-gamut display reports p3 when rec2020 does not match', () => {
    expect(
      getColorGamutValue({
        matchMedia: makeMatchMedia(new Set(['(color-gamut: p3)', '(color-gamut: srgb)'])),
      }),
    ).toBe('p3')
  })

  it('unsupported CSS / no matches → undefined (never invents srgb)', () => {
    expect(detectColorGamut(makeMatchMedia(new Set()))).toBeUndefined()
    expect(getColorGamutValue({ matchMedia: makeMatchMedia(() => false) })).toBeUndefined()
  })

  it('missing matchMedia → undefined', () => {
    expect(getColorGamutValue({ matchMedia: null })).toBeUndefined()
    expect(getColorGamutValue()).toBeUndefined()
  })

  it('browser spoofing: injected matchMedia controls the result', () => {
    expect(
      getColorGamutValue({
        matchMedia: makeMatchMedia((q) => q === '(color-gamut: rec2020)'),
      }),
    ).toBe('rec2020')
    expect(
      getColorGamutValue({
        matchMedia: makeMatchMedia((q) => q === '(color-gamut: srgb)'),
      }),
    ).toBe('srgb')
  })

  it('repeated calls are deterministic for fixed injects', () => {
    const mm = makeMatchMedia(new Set(['(color-gamut: p3)', '(color-gamut: srgb)']))
    expect(getColorGamutValue({ matchMedia: mm })).toBe(getColorGamutValue({ matchMedia: mm }))
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getColorGamutValue({ matchMedia: hostile })).toThrow('matchMedia blocked')

    const source: Source<BuiltinSourceOptions, ReturnType<typeof getColorGamutValue>> = () =>
      getColorGamutValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin colorGamut wiring', () => {
  it('wires colorGamut as source #26; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[25]).toBe('colorGamut')
    expect(sources.colorGamut).toBe(getColorGamut)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.colorGamut)).toBe(true)
    if (isValueComponent(result.components.colorGamut)) {
      expect(result.components.colorGamut.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        colorGamut: { value: 'p3', duration: 1 },
      }),
    ).toContain('colorGamut:')
    expect(
      hashComponents({
        colorGamut: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
