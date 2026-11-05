import {
  ENABLED_SOURCES,
  PLUGIN_SDK_REVISION,
  PluginDependencyError,
  PluginJsonSafetyError,
  PluginRegistrationError,
  PluginTimeoutError,
  createBuiltinSources,
  createPersianFontProbePlugin,
  hashComponents,
  load,
  loadWithPlugins,
  pluginManifestToJson,
  resolvePlugins,
  type BuiltinSources,
  type PluginDefinition,
} from '@night-watch/browser-sdk'
import { describe, expect, it, vi } from 'vitest'

function minimalBuiltins(): BuiltinSources {
  return {
    platform: () => 'TestPlatform',
  } as unknown as BuiltinSources
}

function makePlugin(
  partial: Partial<PluginDefinition> & Pick<PluginDefinition, 'id' | 'key' | 'collect'>,
): PluginDefinition {
  return {
    version: '1.0.0',
    jsonSafe: true,
    ...partial,
  }
}

describe('plugin registration / collisions', () => {
  it('rejects empty plugin list, applePay, builtin collisions, and duplicate keys', () => {
    expect(() => resolvePlugins([])).toThrow(PluginRegistrationError)

    expect(() =>
      resolvePlugins([
        makePlugin({
          id: 'pay',
          key: 'applePay',
          collect: () => 1,
        }),
      ]),
    ).toThrow(/applePay/)

    expect(() =>
      resolvePlugins([
        makePlugin({
          id: 'collide',
          key: 'platform',
          collect: () => 'x',
        }),
      ]),
    ).toThrow(/collides with a builtin/)

    expect(() =>
      resolvePlugins([
        makePlugin({ id: 'a', key: 'ext:a', collect: () => 1 }),
        makePlugin({ id: 'b', key: 'ext:a', collect: () => 2 }),
      ]),
    ).toThrow(/Duplicate plugin key/)

    expect(() =>
      resolvePlugins([
        makePlugin({ id: 'no-prefix', key: 'customMark', collect: () => 1 }),
      ]),
    ).toThrow(/required prefix/)
  })

  it('allows builtin overwrite only when policy opts in', () => {
    const { ordered } = resolvePlugins(
      [makePlugin({ id: 'p', key: 'platform', collect: () => 'X' })],
      { allowOverwriteBuiltins: true, requiredKeyPrefix: '' },
    )
    expect(ordered[0]?.key).toBe('platform')
  })

  it('detects dependency cycles', () => {
    expect(() =>
      resolvePlugins([
        makePlugin({
          id: 'a',
          key: 'ext:a',
          dependsOn: ['ext:b'],
          collect: () => 1,
        }),
        makePlugin({
          id: 'b',
          key: 'ext:b',
          dependsOn: ['ext:a'],
          collect: () => 2,
        }),
      ]),
    ).toThrow(PluginDependencyError)
  })
})

describe('plugin manifests and ordering', () => {
  it('builds versioned diffable manifests and topo order', () => {
    const { resolution, ordered } = resolvePlugins([
      makePlugin({
        id: 'child',
        key: 'ext:child',
        dependsOn: ['ext:parent', 'platform'],
        collect: () => 'c',
      }),
      makePlugin({
        id: 'parent',
        key: 'ext:parent',
        collect: () => 'p',
      }),
    ])

    expect(resolution.manifest.revision).toBe(PLUGIN_SDK_REVISION)
    expect(resolution.visitorIdWillDifferFromFullDefault).toBe(true)
    expect(ordered.map((p) => p.key)).toEqual(['ext:parent', 'ext:child'])
    expect(resolution.manifest.executionOrder).toEqual(['ext:parent', 'ext:child'])

    const json = pluginManifestToJson(resolution.manifest)
    expect(json).toContain('night-watch-plugin-sdk-v1')
    expect(pluginManifestToJson(resolution.manifest)).toBe(json)
  })
})

describe('loadWithPlugins isolation / cleanup / failures', () => {
  it('default load is unchanged when plugin API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).toEqual([...ENABLED_SOURCES])
    expect(Object.keys(result.components).some((k) => k.startsWith('ext:'))).toBe(false)
  })

  it('successful plugin appends namespaced key and changes visitorId', async () => {
    const baseline = await (
      await load({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: minimalBuiltins(),
      })
    ).get()

    const { agent, resolution } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [
        makePlugin({
          id: 'mark',
          key: 'ext:mark',
          collect: () => ({ ok: true, locale: 'fa-IR' }),
        }),
      ],
    })
    const result = await agent.get()
    expect(resolution.pluginKeys).toEqual(['ext:mark'])
    expect(result.components).toHaveProperty('ext:mark')
    expect(result.components).toHaveProperty('platform')
    expect(result.visitorId).not.toBe(baseline.visitorId)
    expect(result.visitorId).toBe(hashComponents(result.components))
    expect(Object.keys(result.components)).not.toContain('applePay')
  })

  it('custom collector failure becomes error component and does not block others', async () => {
    const { agent } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [
        makePlugin({
          id: 'bad',
          key: 'ext:bad',
          collect: () => {
            throw new Error('boom')
          },
        }),
        makePlugin({
          id: 'good',
          key: 'ext:good',
          collect: () => 'ok',
        }),
      ],
    })
    const result = await agent.get()
    expect(result.components['ext:bad']).toMatchObject({ error: expect.any(Error) })
    expect(result.components['ext:good']).toMatchObject({ value: 'ok' })
  })

  it('invokes cleanup on success and on failure', async () => {
    const successCleanup = vi.fn()
    const failCleanup = vi.fn()

    const { agent } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [
        makePlugin({
          id: 'ok',
          key: 'ext:ok',
          collect: () => 1,
          cleanup: successCleanup,
        }),
        makePlugin({
          id: 'fail',
          key: 'ext:fail',
          collect: () => {
            throw new Error('nope')
          },
          cleanup: failCleanup,
        }),
      ],
    })
    await agent.get()
    expect(successCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'success', key: 'ext:ok' }),
    )
    expect(failCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'error', key: 'ext:fail' }),
    )
  })

  it('enforces timeout budgets', async () => {
    const cleanup = vi.fn()
    const { agent } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      pluginPolicy: { defaultTimeoutMs: 30, maxTimeoutMs: 50 },
      plugins: [
        makePlugin({
          id: 'slow',
          key: 'ext:slow',
          timeoutMs: 30,
          collect: () => new Promise((resolve) => setTimeout(() => resolve('late'), 200)),
          cleanup: cleanup,
        }),
      ],
    })
    const result = await agent.get()
    expect(result.components['ext:slow']).toMatchObject({
      error: expect.any(PluginTimeoutError),
    })
    expect(cleanup).toHaveBeenCalledWith(expect.objectContaining({ reason: 'timeout' }))
  })

  it('rejects non-JSON-safe results', async () => {
    const { agent } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [
        makePlugin({
          id: 'circular',
          key: 'ext:circular',
          collect: () => {
            const a: { self?: unknown } = {}
            a.self = a
            return a
          },
        }),
      ],
    })
    const result = await agent.get()
    expect(result.components['ext:circular']).toMatchObject({
      error: expect.any(PluginJsonSafetyError),
    })
  })

  it('supports two-stage collect and dependency values', async () => {
    const { agent } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [
        makePlugin({
          id: 'base',
          key: 'ext:base',
          collect: () => () => ({ n: 2 }),
        }),
        makePlugin({
          id: 'derived',
          key: 'ext:derived',
          dependsOn: ['ext:base', 'platform'],
          collect: (ctx) => ({
            fromBase: (ctx.deps['ext:base'] as { n: number }).n,
            fromPlatform: ctx.deps.platform,
          }),
        }),
      ],
    })
    const result = await agent.get()
    expect(result.components['ext:derived']).toMatchObject({
      value: { fromBase: 2, fromPlatform: 'TestPlatform' },
    })
  })

  it('persian font probe plugin is opt-in and never registered by default', async () => {
    const defaultResult = await (
      await load({
        delayFallback: 0,
        allowNonBrowser: true,
        sources: createBuiltinSources(),
      })
    ).get()
    expect(defaultResult.components).not.toHaveProperty('ext:persianFontProbe')

    const plugin = createPersianFontProbePlugin({
      documentProbe: () => ({ status: 'unsupported' }),
    })
    expect(plugin.key).toBe('ext:persianFontProbe')

    const { agent, resolution } = await loadWithPlugins({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: minimalBuiltins(),
      plugins: [plugin],
    })
    const result = await agent.get()
    expect(resolution.manifest.plugins[0]?.id).toBe('night-watch-example-persian-font-probe')
    expect(result.components['ext:persianFontProbe']).toMatchObject({
      value: {
        available: [],
        document: 'unsupported',
      },
    })
    expect(Object.keys(defaultResult.components)).toHaveLength(41)
  })
})
