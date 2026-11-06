import {
  componentsToCanonicalString,
  createBuiltinSources,
  getTouchSupport,
  getTouchSupportValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  probeTouchEvent,
  probeTouchStart,
  readMaxTouchPoints,
  type TouchSupport,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readMaxTouchPoints / probeTouchEvent / probeTouchStart', () => {
  it('reads maxTouchPoints via toInt; falls back to msMaxTouchPoints; else 0', () => {
    expect(readMaxTouchPoints({ navigator: { maxTouchPoints: 10 } })).toBe(10)
    expect(readMaxTouchPoints({ navigator: { maxTouchPoints: '5' as unknown as number } })).toBe(5)
    expect(readMaxTouchPoints({ navigator: { msMaxTouchPoints: 2 } })).toBe(2)
    expect(readMaxTouchPoints({ navigator: {} })).toBe(0)
    expect(readMaxTouchPoints({ navigator: null })).toBe(0)
    expect(readMaxTouchPoints()).toBe(0)
  })

  it('prefers maxTouchPoints over msMaxTouchPoints when both present', () => {
    expect(
      readMaxTouchPoints({
        navigator: { maxTouchPoints: 1, msMaxTouchPoints: 99 },
      }),
    ).toBe(1)
  })

  it('treats negative / zero maxTouchPoints as reported (hybrid / no-touch)', () => {
    expect(readMaxTouchPoints({ navigator: { maxTouchPoints: 0 } })).toBe(0)
    expect(readMaxTouchPoints({ navigator: { maxTouchPoints: -1 } })).toBe(-1)
  })

  it('touchEvent true when createEvent(TouchEvent) succeeds', () => {
    expect(
      probeTouchEvent({
        document: {
          createEvent: () => ({}) as Event,
        },
      }),
    ).toBe(true)
  })

  it('touchEvent false when TouchEvent unsupported / createEvent throws', () => {
    expect(
      probeTouchEvent({
        document: {
          createEvent: () => {
            throw new Error('NOT_SUPPORTED_ERR')
          },
        },
      }),
    ).toBe(false)
    expect(probeTouchEvent({ document: {} })).toBe(false)
    expect(probeTouchEvent({ document: null })).toBe(false)
    expect(probeTouchEvent()).toBe(false)
  })

  it('touchStart reflects ontouchstart property presence on window', () => {
    expect(probeTouchStart({ window: { ontouchstart: null } })).toBe(true)
    expect(probeTouchStart({ window: {} })).toBe(false)
    expect(probeTouchStart({ window: null })).toBe(false)
    expect(probeTouchStart()).toBe(false)
  })
})

describe('getTouchSupportValue', () => {
  it('assembles maxTouchPoints + touchEvent + touchStart independently', () => {
    const value = getTouchSupportValue({
      navigator: { maxTouchPoints: 5 },
      document: {
        createEvent: () => {
          throw new Error('unsupported')
        },
      },
      window: { ontouchstart: undefined },
    })
    expect(value).toEqual({
      maxTouchPoints: 5,
      touchEvent: false,
      touchStart: true,
    })
  })

  it('synthetic touchscreen: points + TouchEvent + ontouchstart', () => {
    expect(
      getTouchSupportValue({
        navigator: { maxTouchPoints: 10 },
        document: { createEvent: () => ({}) as Event },
        window: { ontouchstart: null },
      }),
    ).toEqual({
      maxTouchPoints: 10,
      touchEvent: true,
      touchStart: true,
    })
  })

  it('desktop no-touch baseline', () => {
    expect(
      getTouchSupportValue({
        navigator: { maxTouchPoints: 0 },
        document: {
          createEvent: () => {
            throw new Error('no TouchEvent')
          },
        },
        window: {},
      }),
    ).toEqual({
      maxTouchPoints: 0,
      touchEvent: false,
      touchStart: false,
    })
  })

  it('surfaces createEvent throws only as touchEvent=false (not component error)', () => {
    const value = getTouchSupportValue({
      navigator: { maxTouchPoints: 1 },
      document: {
        createEvent: () => {
          throw new Error('blocked')
        },
      },
      window: {},
    })
    expect(value.touchEvent).toBe(false)
  })

  it('hostile maxTouchPoints getter becomes loadSource error', async () => {
    const hostile = {
      get maxTouchPoints() {
        throw new Error('touch privacy')
      },
    }
    expect(() => getTouchSupportValue({ navigator: hostile, document: null, window: null })).toThrow(
      'touch privacy',
    )

    const source: Source<BuiltinSourceOptions, TouchSupport> = () =>
      getTouchSupportValue({ navigator: hostile, document: null, window: null })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })

  it('repeated calls are deterministic for fixed injects', () => {
    const opts = {
      navigator: { maxTouchPoints: 2 },
      document: { createEvent: () => ({}) as Event },
      window: { ontouchstart: null },
    }
    expect(getTouchSupportValue(opts)).toEqual(getTouchSupportValue(opts))
  })
})

describe('builtin touchSupport wiring', () => {
  it('wires touchSupport as source #22; Node yields zeros/false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[21]).toBe('touchSupport')
    expect(sources.touchSupport).toBe(getTouchSupport)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.touchSupport)).toBe(true)
    if (isValueComponent(result.components.touchSupport)) {
      expect(result.components.touchSupport.value).toEqual({
        maxTouchPoints: 0,
        touchEvent: false,
        touchStart: false,
      })
    }

    expect(
      componentsToCanonicalString({
        touchSupport: {
          value: { maxTouchPoints: 5, touchEvent: true, touchStart: true },
          duration: 1,
        },
      }),
    ).toContain('touchSupport:')
    expect(
      hashComponents({
        touchSupport: {
          value: { maxTouchPoints: 0, touchEvent: false, touchStart: false },
          duration: 1,
        },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
