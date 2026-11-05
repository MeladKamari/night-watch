import {
  componentsToCanonicalString,
  createBuiltinSources,
  detectHdr,
  getHdr,
  getHdrValue,
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

describe('detectHdr / getHdrValue', () => {
  it('HDR monitor (high) → true', () => {
    expect(detectHdr(makeMatchMedia(new Set(['(dynamic-range: high)'])))).toBe(true)
  })

  it('SDR monitor (standard) → false', () => {
    expect(detectHdr(makeMatchMedia(new Set(['(dynamic-range: standard)'])))).toBe(false)
  })

  it('unsupported query / missing matchMedia → undefined', () => {
    expect(detectHdr(makeMatchMedia(new Set()))).toBeUndefined()
    expect(getHdrValue({ matchMedia: null })).toBeUndefined()
    expect(getHdrValue()).toBeUndefined()
  })

  it('prefers high over standard when both somehow match', () => {
    expect(
      detectHdr(
        makeMatchMedia(new Set(['(dynamic-range: high)', '(dynamic-range: standard)'])),
      ),
    ).toBe(true)
  })

  it('deterministic serialization / repeated calls', () => {
    const mm = makeMatchMedia(new Set(['(dynamic-range: standard)']))
    expect(getHdrValue({ matchMedia: mm })).toBe(getHdrValue({ matchMedia: mm }))
    expect(
      componentsToCanonicalString({
        hdr: { value: true, duration: 1 },
      }),
    ).toContain('hdr:')
    expect(
      hashComponents({
        hdr: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })

  it('surfaces matchMedia exceptions to loadSource error path', async () => {
    const hostile: MatchMediaLike = () => {
      throw new Error('matchMedia blocked')
    }
    expect(() => getHdrValue({ matchMedia: hostile })).toThrow('matchMedia blocked')

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getHdrValue({ matchMedia: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin hdr wiring', () => {
  it('wires hdr as source #33; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[32]).toBe('hdr')
    expect(sources.hdr).toBe(getHdr)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.hdr)).toBe(true)
    if (isValueComponent(result.components.hdr)) {
      expect(result.components.hdr.value).toBeUndefined()
    }
  })
})
