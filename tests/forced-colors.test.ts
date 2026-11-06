import {
  componentsToCanonicalString,
  createBuiltinSources,
  detectForcedColors,
  getForcedColors,
  getForcedColorsValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  type MatchMediaLike,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

function makeMatchMedia(matching: ReadonlySet<string>): MatchMediaLike {
  return (query: string) => ({ matches: matching.has(query) })
}

describe('detectForcedColors / getForcedColorsValue', () => {
  it('Windows high contrast (active) → true', () => {
    expect(
      detectForcedColors(makeMatchMedia(new Set(['(forced-colors: active)']))),
    ).toBe(true)
    expect(
      getForcedColorsValue({
        matchMedia: makeMatchMedia(new Set(['(forced-colors: active)'])),
      }),
    ).toBe(true)
  })

  it('valid false (none) → false', () => {
    expect(
      detectForcedColors(makeMatchMedia(new Set(['(forced-colors: none)']))),
    ).toBe(false)
  })

  it('media query unsupported (neither matches) → undefined', () => {
    expect(detectForcedColors(makeMatchMedia(new Set()))).toBeUndefined()
    expect(
      getForcedColorsValue({ matchMedia: makeMatchMedia(new Set()) }),
    ).toBeUndefined()
  })

  it('missing matchMedia → undefined (never invent false)', () => {
    expect(getForcedColorsValue({ matchMedia: null })).toBeUndefined()
    expect(getForcedColorsValue()).toBeUndefined()
  })

  it('prefers active over none when both somehow match', () => {
    expect(
      detectForcedColors(
        makeMatchMedia(new Set(['(forced-colors: active)', '(forced-colors: none)'])),
      ),
    ).toBe(true)
  })

  it('repeated calls are deterministic', () => {
    const mm = makeMatchMedia(new Set(['(forced-colors: none)']))
    expect(getForcedColorsValue({ matchMedia: mm })).toBe(
      getForcedColorsValue({ matchMedia: mm }),
    )
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getForcedColorsValue({ matchMedia: hostile })).toThrow('matchMedia blocked')

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getForcedColorsValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin forcedColors wiring', () => {
  it('wires forcedColors as source #28; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[27]).toBe('forcedColors')
    expect(sources.forcedColors).toBe(getForcedColors)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.forcedColors)).toBe(true)
    if (isValueComponent(result.components.forcedColors)) {
      expect(result.components.forcedColors.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        forcedColors: { value: true, duration: 1 },
      }),
    ).toContain('forcedColors:')
    expect(
      hashComponents({
        forcedColors: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
