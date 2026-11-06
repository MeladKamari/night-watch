import {
  MONOCHROME_MAX_VALUE_TO_CHECK,
  componentsToCanonicalString,
  createBuiltinSources,
  detectMonochromeDepth,
  getMonochrome,
  getMonochromeValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  type MatchMediaLike,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

/**
 * Simulates monochrome media queries for a known depth.
 * - Unsupported: min-monochrome never matches
 * - Depth n: min-monochrome:0 matches; max-monochrome:i matches iff i >= n
 */
function makeMonochromeMedia(
  mode: { unsupported: true } | { depth: number },
): MatchMediaLike {
  return (query: string) => {
    if ('unsupported' in mode) {
      return { matches: false }
    }
    if (query === '(min-monochrome: 0)') {
      return { matches: true }
    }
    const max = /^\(max-monochrome: (\d+)\)$/.exec(query)
    if (max) {
      return { matches: Number(max[1]) >= mode.depth }
    }
    return { matches: false }
  }
}

describe('detectMonochromeDepth / getMonochromeValue', () => {
  it('unsupported feature → undefined', () => {
    expect(detectMonochromeDepth(makeMonochromeMedia({ unsupported: true }))).toBeUndefined()
    expect(
      getMonochromeValue({ matchMedia: makeMonochromeMedia({ unsupported: true }) }),
    ).toBeUndefined()
  })

  it('color display (depth 0) → 0', () => {
    expect(detectMonochromeDepth(makeMonochromeMedia({ depth: 0 }))).toBe(0)
  })

  it('positive monochrome depths return bits-per-pixel', () => {
    expect(detectMonochromeDepth(makeMonochromeMedia({ depth: 1 }))).toBe(1)
    expect(detectMonochromeDepth(makeMonochromeMedia({ depth: 8 }))).toBe(8)
    expect(detectMonochromeDepth(makeMonochromeMedia({ depth: 10 }))).toBe(10)
  })

  it('search is bounded (no infinite loop); too-high throws', () => {
    expect(MONOCHROME_MAX_VALUE_TO_CHECK).toBe(100)

    const neverMax: MatchMediaLike = (query) => {
      if (query === '(min-monochrome: 0)') {
        return { matches: true }
      }
      return { matches: false }
    }

    let calls = 0
    const counting: MatchMediaLike = (query) => {
      calls += 1
      return neverMax(query)
    }
    expect(() => detectMonochromeDepth(counting)).toThrow('Too high value')
    // 1 min check + 101 max checks (0..100)
    expect(calls).toBe(1 + MONOCHROME_MAX_VALUE_TO_CHECK + 1)
  })

  it('missing matchMedia → undefined', () => {
    expect(getMonochromeValue({ matchMedia: null })).toBeUndefined()
    expect(getMonochromeValue()).toBeUndefined()
  })

  it('repeated calls are deterministic', () => {
    const mm = makeMonochromeMedia({ depth: 2 })
    expect(getMonochromeValue({ matchMedia: mm })).toBe(getMonochromeValue({ matchMedia: mm }))
  })

  it('surfaces matchMedia throws / too-high to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getMonochromeValue({ matchMedia: hostile })).toThrow('matchMedia blocked')

    const tooHigh: MatchMediaLike = (query) =>
      query === '(min-monochrome: 0)' ? { matches: true } : { matches: false }

    const source: Source<BuiltinSourceOptions, number | undefined> = () =>
      getMonochromeValue({ matchMedia: tooHigh })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin monochrome wiring', () => {
  it('wires monochrome as source #29; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[28]).toBe('monochrome')
    expect(sources.monochrome).toBe(getMonochrome)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.monochrome)).toBe(true)
    if (isValueComponent(result.components.monochrome)) {
      expect(result.components.monochrome.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        monochrome: { value: 0, duration: 1 },
      }),
    ).toContain('monochrome:')
    expect(
      hashComponents({
        monochrome: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
