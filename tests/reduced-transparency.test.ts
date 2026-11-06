import {
  componentsToCanonicalString,
  createBuiltinSources,
  detectReducedTransparency,
  getReducedTransparency,
  getReducedTransparencyValue,
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

describe('detectReducedTransparency / getReducedTransparencyValue', () => {
  it('toggle reduce → true', () => {
    expect(
      detectReducedTransparency(
        makeMatchMedia(new Set(['(prefers-reduced-transparency: reduce)'])),
      ),
    ).toBe(true)
  })

  it('no-preference → false', () => {
    expect(
      detectReducedTransparency(
        makeMatchMedia(new Set(['(prefers-reduced-transparency: no-preference)'])),
      ),
    ).toBe(false)
  })

  it('older browsers / unsupported → undefined (no hardcoded default)', () => {
    expect(detectReducedTransparency(makeMatchMedia(new Set()))).toBeUndefined()
    expect(getReducedTransparencyValue({ matchMedia: null })).toBeUndefined()
    expect(getReducedTransparencyValue()).toBeUndefined()
  })

  it('prefers reduce over no-preference when both somehow match', () => {
    expect(
      detectReducedTransparency(
        makeMatchMedia(
          new Set([
            '(prefers-reduced-transparency: reduce)',
            '(prefers-reduced-transparency: no-preference)',
          ]),
        ),
      ),
    ).toBe(true)
  })

  it('deterministic serialization / repeated calls', () => {
    const mm = makeMatchMedia(
      new Set(['(prefers-reduced-transparency: no-preference)']),
    )
    expect(getReducedTransparencyValue({ matchMedia: mm })).toBe(
      getReducedTransparencyValue({ matchMedia: mm }),
    )
    expect(
      componentsToCanonicalString({
        reducedTransparency: { value: true, duration: 1 },
      }),
    ).toContain('reducedTransparency:')
    expect(
      hashComponents({
        reducedTransparency: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getReducedTransparencyValue({ matchMedia: hostile })).toThrow(
      'matchMedia blocked',
    )

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getReducedTransparencyValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin reducedTransparency wiring', () => {
  it('wires reducedTransparency as source #32; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[31]).toBe('reducedTransparency')
    expect(sources.reducedTransparency).toBe(getReducedTransparency)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.reducedTransparency)).toBe(true)
    if (isValueComponent(result.components.reducedTransparency)) {
      expect(result.components.reducedTransparency.value).toBeUndefined()
    }
  })
})
