import {
  ContrastPreference,
  componentsToCanonicalString,
  createBuiltinSources,
  detectContrastPreference,
  getContrast,
  getContrastValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  type MatchMediaLike,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

function makeMatchMedia(matching: ReadonlySet<string>): MatchMediaLike {
  return (query: string) => ({ matches: matching.has(query) })
}

describe('detectContrastPreference / getContrastValue', () => {
  it('maps no-preference / more|high / less|low / forced to stable codes', () => {
    expect(ContrastPreference).toEqual({
      Less: -1,
      None: 0,
      More: 1,
      ForcedColors: 10,
    })

    expect(
      detectContrastPreference(
        makeMatchMedia(new Set(['(prefers-contrast: no-preference)'])),
      ),
    ).toBe(ContrastPreference.None)

    expect(
      detectContrastPreference(makeMatchMedia(new Set(['(prefers-contrast: more)']))),
    ).toBe(ContrastPreference.More)
    expect(
      detectContrastPreference(makeMatchMedia(new Set(['(prefers-contrast: high)']))),
    ).toBe(ContrastPreference.More)

    expect(
      detectContrastPreference(makeMatchMedia(new Set(['(prefers-contrast: less)']))),
    ).toBe(ContrastPreference.Less)
    expect(
      detectContrastPreference(makeMatchMedia(new Set(['(prefers-contrast: low)']))),
    ).toBe(ContrastPreference.Less)

    expect(
      detectContrastPreference(makeMatchMedia(new Set(['(prefers-contrast: forced)']))),
    ).toBe(ContrastPreference.ForcedColors)
  })

  it('multiple incompatible values: no-preference wins first', () => {
    expect(
      detectContrastPreference(
        makeMatchMedia(
          new Set([
            '(prefers-contrast: no-preference)',
            '(prefers-contrast: more)',
            '(prefers-contrast: forced)',
          ]),
        ),
      ),
    ).toBe(ContrastPreference.None)
  })

  it('prefers-contrast unsupported → undefined (never invent None)', () => {
    expect(detectContrastPreference(makeMatchMedia(new Set()))).toBeUndefined()
    expect(getContrastValue({ matchMedia: null })).toBeUndefined()
    expect(getContrastValue()).toBeUndefined()
  })

  it('forced colors keyword maps to ForcedColors code', () => {
    expect(
      getContrastValue({
        matchMedia: makeMatchMedia(new Set(['(prefers-contrast: forced)'])),
      }),
    ).toBe(ContrastPreference.ForcedColors)
  })

  it('platform theme change inject flips more ↔ less deterministically', () => {
    const more = makeMatchMedia(new Set(['(prefers-contrast: more)']))
    const less = makeMatchMedia(new Set(['(prefers-contrast: less)']))
    expect(getContrastValue({ matchMedia: more })).toBe(ContrastPreference.More)
    expect(getContrastValue({ matchMedia: less })).toBe(ContrastPreference.Less)
    expect(getContrastValue({ matchMedia: more })).toBe(getContrastValue({ matchMedia: more }))
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getContrastValue({ matchMedia: hostile })).toThrow('matchMedia blocked')

    const source: Source<BuiltinSourceOptions, ReturnType<typeof getContrastValue>> = () =>
      getContrastValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin contrast wiring', () => {
  it('wires contrast as source #30; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[29]).toBe('contrast')
    expect(sources.contrast).toBe(getContrast)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.contrast)).toBe(true)
    if (isValueComponent(result.components.contrast)) {
      expect(result.components.contrast.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        contrast: { value: ContrastPreference.More, duration: 1 },
      }),
    ).toContain('contrast:')
    expect(
      hashComponents({
        contrast: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
