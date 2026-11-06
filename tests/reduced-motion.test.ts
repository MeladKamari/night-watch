import {
  componentsToCanonicalString,
  createBuiltinSources,
  detectReducedMotion,
  getReducedMotion,
  getReducedMotionValue,
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

describe('detectReducedMotion / getReducedMotionValue', () => {
  it('OS reduce toggle → true', () => {
    expect(
      detectReducedMotion(
        makeMatchMedia(new Set(['(prefers-reduced-motion: reduce)'])),
      ),
    ).toBe(true)
  })

  it('no-preference → false', () => {
    expect(
      detectReducedMotion(
        makeMatchMedia(new Set(['(prefers-reduced-motion: no-preference)'])),
      ),
    ).toBe(false)
  })

  it('unsupported / matchMedia absent → undefined', () => {
    expect(detectReducedMotion(makeMatchMedia(new Set()))).toBeUndefined()
    expect(getReducedMotionValue({ matchMedia: null })).toBeUndefined()
    expect(getReducedMotionValue()).toBeUndefined()
  })

  it('prefers reduce over no-preference when both somehow match', () => {
    expect(
      detectReducedMotion(
        makeMatchMedia(
          new Set([
            '(prefers-reduced-motion: reduce)',
            '(prefers-reduced-motion: no-preference)',
          ]),
        ),
      ),
    ).toBe(true)
  })

  it('deterministic serialization / repeated calls', () => {
    const mm = makeMatchMedia(new Set(['(prefers-reduced-motion: no-preference)']))
    expect(getReducedMotionValue({ matchMedia: mm })).toBe(
      getReducedMotionValue({ matchMedia: mm }),
    )
    expect(
      componentsToCanonicalString({
        reducedMotion: { value: true, duration: 1 },
      }),
    ).toContain('reducedMotion:')
    expect(
      hashComponents({
        reducedMotion: { value: false, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })

  it('surfaces matchMedia throws to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getReducedMotionValue({ matchMedia: hostile })).toThrow(
      'matchMedia blocked',
    )

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getReducedMotionValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin reducedMotion wiring', () => {
  it('wires reducedMotion as source #31; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[30]).toBe('reducedMotion')
    expect(sources.reducedMotion).toBe(getReducedMotion)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.reducedMotion)).toBe(true)
    if (isValueComponent(result.components.reducedMotion)) {
      expect(result.components.reducedMotion.value).toBeUndefined()
    }
  })
})
