import {
  collectPlugins,
  componentsToCanonicalString,
  createBuiltinSources,
  getPlugins,
  getPluginsValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  type PluginArrayLike,
  type PluginLike,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

function makePlugin(
  name: string,
  description: string,
  mimeTypes: Array<{ type: string; suffixes: string }>,
): PluginLike {
  const plugin = {
    name,
    description,
    length: mimeTypes.length,
  } as PluginLike
  mimeTypes.forEach((mt, i) => {
    ;(plugin as { [k: number]: unknown })[i] = mt
  })
  return plugin
}

function makePluginArray(plugins: Array<PluginLike | null>): PluginArrayLike {
  const arr = { length: plugins.length } as PluginArrayLike
  plugins.forEach((p, i) => {
    ;(arr as { [k: number]: PluginLike | null })[i] = p
  })
  return arr
}

describe('collectPlugins / getPluginsValue', () => {
  it('serializes plugins with mimeTypes in source order', () => {
    const raw = makePluginArray([
      makePlugin('Chrome PDF Viewer', '', [
        { type: 'application/pdf', suffixes: 'pdf' },
      ]),
      makePlugin('Native Client', 'nacl', [
        { type: 'application/x-nacl', suffixes: '' },
      ]),
    ])
    expect(collectPlugins(raw)).toEqual([
      {
        name: 'Chrome PDF Viewer',
        description: '',
        mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf' }],
      },
      {
        name: 'Native Client',
        description: 'nacl',
        mimeTypes: [{ type: 'application/x-nacl', suffixes: '' }],
      },
    ])
  })

  it('skips null plugin entries; empty list stays empty array', () => {
    expect(
      collectPlugins(
        makePluginArray([null, makePlugin('Only', 'd', [{ type: 'a/b', suffixes: 'x' }]), null]),
      ),
    ).toEqual([
      {
        name: 'Only',
        description: 'd',
        mimeTypes: [{ type: 'a/b', suffixes: 'x' }],
      },
    ])
    expect(collectPlugins(makePluginArray([]))).toEqual([])
    expect(getPluginsValue({ plugins: makePluginArray([]) })).toEqual([])
  })

  it('returns undefined when plugins collection is absent (hidden / missing)', () => {
    expect(getPluginsValue({ plugins: null })).toBeUndefined()
    expect(getPluginsValue({ plugins: undefined })).toBeUndefined()
    expect(getPluginsValue()).toBeUndefined()
  })

  it('does not execute plugins (no method calls beyond property reads)', () => {
    let executed = false
    const plugin = makePlugin('PDF', '', [{ type: 'application/pdf', suffixes: 'pdf' }])
    ;(plugin as { refresh?: () => void }).refresh = () => {
      executed = true
    }
    collectPlugins(makePluginArray([plugin]))
    expect(executed).toBe(false)
  })

  it('surfaces plugin getter throws to loadSource error path', async () => {
    const hostile = {
      get length() {
        return 1
      },
      get 0() {
        throw new Error('plugins blocked')
      },
    } as unknown as PluginArrayLike
    expect(() => getPluginsValue({ plugins: hostile })).toThrow('plugins blocked')

    const source: Source<BuiltinSourceOptions, ReturnType<typeof getPluginsValue>> = () =>
      getPluginsValue({ plugins: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin plugins wiring', () => {
  it('wires plugins as source #21; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[20]).toBe('plugins')
    expect(sources.plugins).toBe(getPlugins)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.plugins)).toBe(true)
    if (isValueComponent(result.components.plugins)) {
      expect(result.components.plugins.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        plugins: {
          value: [{ name: 'PDF', description: '', mimeTypes: [] }],
          duration: 1,
        },
      }),
    ).toContain('plugins:')
    expect(
      hashComponents({
        plugins: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
