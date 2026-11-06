import {
  componentsToCanonicalString,
  createBuiltinSources,
  detectInvertedColors,
  getInvertedColors,
  getInvertedColorsValue,
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

describe('detectInvertedColors / getInvertedColorsValue', () => {
  it('inverted active → true', () => {
    expect(
      detectInvertedColors(makeMatchMedia(new Set(['(inverted-colors: inverted)']))),
    ).toBe(true)
    expect(
      getInvertedColorsValue({
        matchMedia: makeMatchMedia(new Set(['(inverted-colors: inverted)'])),
      }),
    ).toBe(true)
  })

  it('no preference (none) → false', () => {
    expect(
      detectInvertedColors(makeMatchMedia(new Set(['(inverted-colors: none)']))),
    ).toBe(false)
  })

  it('unsupported feature (neither matches) → undefined', () => {
    expect(detectInvertedColors(makeMatchMedia(new Set()))).toBeUndefined()
    expect(
      getInvertedColorsValue({ matchMedia: makeMatchMedia(new Set()) }),
    ).toBeUndefined()
  })

  it('missing matchMedia → undefined (never invent false)', () => {
    expect(getInvertedColorsValue({ matchMedia: null })).toBeUndefined()
    expect(getInvertedColorsValue()).toBeUndefined()
  })

  it('prefers inverted over none when both somehow match', () => {
    expect(
      detectInvertedColors(
        makeMatchMedia(
          new Set(['(inverted-colors: inverted)', '(inverted-colors: none)']),
        ),
      ),
    ).toBe(true)
  })

  it('repeated calls are deterministic', () => {
    const mm = makeMatchMedia(new Set(['(inverted-colors: none)']))
    expect(getInvertedColorsValue({ matchMedia: mm })).toBe(
      getInvertedColorsValue({ matchMedia: mm }),
    )
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getInvertedColorsValue({ matchMedia: hostile })).toThrow(
      'matchMedia blocked',
    )

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getInvertedColorsValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin invertedColors wiring', () => {
  it('wires invertedColors as source #27; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[26]).toBe('invertedColors')
    expect(sources.invertedColors).toBe(getInvertedColors)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.invertedColors)).toBe(true)
    if (isValueComponent(result.components.invertedColors)) {
      expect(result.components.invertedColors.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        invertedColors: { value: true, duration: 1 },
      }),
    ).toContain('invertedColors:')
    expect(
      hashComponents({
        invertedColors: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
