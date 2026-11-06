import {
  isErrorComponent,
  isValueComponent,
  loadSource,
  loadSources,
  transformSource,
  wait,
  type Source,
} from '@thenightwatch/core'
import { describe, expect, it, vi } from 'vitest'

type Opts = { cache: Record<string, unknown>; debug?: boolean }

describe('two-stage collector engine', () => {
  it('supports sync value sources', async () => {
    const source: Source<Opts, string> = () => 'sync-value'
    const get = loadSource(source, { cache: {} })
    const component = await get()
    expect(isValueComponent(component)).toBe(true)
    if (isValueComponent(component)) {
      expect(component.value).toBe('sync-value')
      expect(component.duration).toBeGreaterThanOrEqual(0)
    }
  })

  it('supports async Promise value sources', async () => {
    const source: Source<Opts, number> = async () => {
      await wait(5)
      return 42
    }
    const get = loadSource(source, { cache: {} })
    const component = await get()
    expect(isValueComponent(component)).toBe(true)
    if (isValueComponent(component)) {
      expect(component.value).toBe(42)
      expect(component.duration).toBeGreaterThanOrEqual(5)
    }
  })

  it('supports deferred getter sources', async () => {
    const source: Source<Opts, string> = () => () => 'deferred'
    const get = loadSource(source, { cache: {} })
    const component = await get()
    expect(isValueComponent(component)).toBe(true)
    if (isValueComponent(component)) {
      expect(component.value).toBe('deferred')
    }
  })

  it('supports Promise of deferred getter sources', async () => {
    const source: Source<Opts, string> = async () => {
      await wait(1)
      return async () => {
        await wait(1)
        return 'async-deferred'
      }
    }
    const get = loadSource(source, { cache: {} })
    const component = await get()
    expect(isValueComponent(component)).toBe(true)
    if (isValueComponent(component)) {
      expect(component.value).toBe('async-deferred')
      expect(component.duration).toBeGreaterThanOrEqual(2)
    }
  })

  it('isolates load-stage failures as component errors', async () => {
    const source: Source<Opts, string> = () => {
      throw new Error('load-boom')
    }
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect(component.error).toBeInstanceOf(Error)
      expect((component.error as Error).message).toBe('load-boom')
    }
  })

  it('isolates get-stage failures as component errors', async () => {
    const source: Source<Opts, string> = () => () => {
      throw new Error('get-boom')
    }
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect((component.error as Error).message).toBe('get-boom')
    }
  })

  it('isolates async rejection failures', async () => {
    const source: Source<Opts, string> = async () => {
      await wait(1)
      throw new Error('async-load-fail')
    }
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
    if (isErrorComponent(component)) {
      expect((component.error as Error).message).toBe('async-load-fail')
    }
  })

  it('preserves declaration order and excludes named sources', async () => {
    const order: string[] = []
    const sources = {
      first: (() => {
        order.push('first')
        return 1
      }) as Source<Opts, number>,
      skipMe: (() => {
        order.push('skipMe')
        return 0
      }) as Source<Opts, number>,
      second: (() => {
        order.push('second')
        return 2
      }) as Source<Opts, number>,
    }

    const getComponents = loadSources(sources, { cache: {} }, ['skipMe'] as const)
    const components = await getComponents()
    expect(Object.keys(components)).toEqual(['first', 'second'])
    expect(order).toEqual(['first', 'second'])
    expect(components.first && isValueComponent(components.first) && components.first.value).toBe(1)
    expect(components.second && isValueComponent(components.second) && components.second.value).toBe(
      2,
    )
    expect('skipMe' in components).toBe(false)
  })

  it('does not fail the whole collection when one source throws', async () => {
    const sources = {
      ok: (() => 'fine') as Source<Opts, string>,
      bad: (() => {
        throw new Error('only-me')
      }) as Source<Opts, string>,
      alsoOk: (() => 'still-fine') as Source<Opts, string>,
    }

    const components = await loadSources(sources, { cache: {} }, [])()
    expect(isValueComponent(components.ok!)).toBe(true)
    expect(isErrorComponent(components.bad!)).toBe(true)
    expect(isValueComponent(components.alsoOk!)).toBe(true)
  })

  it('starts slow async loaders concurrently rather than serially', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const slow =
      (label: string): Source<Opts, string> =>
      async () => {
        concurrent += 1
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await wait(30)
        concurrent -= 1
        return label
      }

    const getComponents = loadSources(
      {
        a: slow('a'),
        b: slow('b'),
        c: slow('c'),
      },
      { cache: {} },
      [],
    )

    // Ensure load stage has started for all before awaiting getComponents fully.
    // loadSources returns sync; calling getComponents waits for loaders + getters.
    const started = Date.now()
    const components = await getComponents()
    const elapsed = Date.now() - started

    expect(isValueComponent(components.a!)).toBe(true)
    expect(isValueComponent(components.b!)).toBe(true)
    expect(isValueComponent(components.c!)).toBe(true)
    expect(maxConcurrent).toBeGreaterThanOrEqual(2)
    // Serial would be ~90ms+; concurrent should be closer to one delay (+ overhead).
    expect(elapsed).toBeLessThan(80)
  })

  it('shares options.cache across sources', async () => {
    const sources = {
      writer: ((options: Opts) => {
        options.cache.token = 'shared'
        return 'w'
      }) as Source<Opts, string>,
      reader: ((options: Opts) => options.cache.token as string) as Source<Opts, string>,
    }

    const cache: Record<string, unknown> = {}
    const components = await loadSources(sources, { cache }, [])()
    expect(isValueComponent(components.reader!) && components.reader.value).toBe('shared')
    expect(cache.token).toBe('shared')
  })

  it('allows repeated getComponent calls with stable values', async () => {
    const source: Source<Opts, number> = () => 99
    const get = loadSource(source, { cache: {} })
    const first = await get()
    const second = await get()
    expect(first).toEqual(second)
    expect(isValueComponent(first) && first.value).toBe(99)
  })

  it('transformSource preserves two-stage async behavior', async () => {
    const source: Source<Opts, number> = async () => {
      await wait(1)
      return () => 5
    }
    const doubled = transformSource(source, (n) => n * 2)
    const component = await loadSource(doubled, { cache: {} })()
    expect(isValueComponent(component) && component.value).toBe(10)
  })

  it('does not register applePay when building a sample registry', async () => {
    const sources = {
      platform: (() => 'Win32') as Source<Opts, string>,
      timezone: (() => 'Asia/Tehran') as Source<Opts, string>,
    }
    const components = await loadSources(sources, { cache: {} }, [])()
    expect(Object.keys(components)).not.toContain('applePay')
    // Asia/Tehran is a measured fixture value here, not a hardcoded product assumption.
    expect(isValueComponent(components.timezone!) && components.timezone.value).toBe('Asia/Tehran')
  })
})

describe('loadSource duration semantics', () => {
  it('measures sync sources without requiring fake timers', async () => {
    vi.spyOn(Date, 'now')
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 1003)
      .mockImplementation(() => 1003)

    const source: Source<Opts, string> = () => 'x'
    const component = await loadSource(source, { cache: {} })()
    expect(isValueComponent(component) && component.duration).toBe(3)
    vi.restoreAllMocks()
  })
})
