import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  RegistryInvariantError,
  componentsToDebugString,
  createBuiltinSources,
  excludes,
  extendComponents,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  loadSources,
  mergeBuiltinSources,
  omitComponents,
  withComponent,
  type BuiltinSourceOptions,
  type Source,
  type UnknownComponents,
} from '@night-watch/browser-sdk'
import { describe, expect, expectTypeOf, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

type Opts = BuiltinSourceOptions

describe('omitComponents / extendComponents / withComponent', () => {
  const base: UnknownComponents = {
    platform: { value: 'Win32', duration: 1 },
    languages: { value: [['fa-IR', 'en-US']], duration: 2 },
    timezone: { value: 'Asia/Tehran', duration: 3 },
  }

  it('omits listed keys and preserves relative order of remaining keys', () => {
    const next = omitComponents(base, ['languages'])
    expect(Object.keys(next)).toEqual(['platform', 'timezone'])
    expect(next.platform).toEqual(base.platform)
    expect(next.timezone).toEqual(base.timezone)
  })

  it('omit is idempotent for missing keys', () => {
    const next = omitComponents(base, ['missing', 'languages', 'missing'])
    expect(Object.keys(next)).toEqual(['platform', 'timezone'])
  })

  it('extend does not overwrite built-in keys by default (collision)', () => {
    const next = extendComponents(base, {
      platform: { value: 'hijack', duration: 0 },
      customSignal: { value: 7, duration: 4 },
    })
    expect(isValueComponent(next.platform)).toBe(true)
    if (isValueComponent(next.platform)) {
      expect(next.platform.value).toBe('Win32')
    }
    expect(isValueComponent(next.customSignal)).toBe(true)
    if (isValueComponent(next.customSignal)) {
      expect(next.customSignal.value).toBe(7)
    }
  })

  it('extend overwrites when overwrite=true', () => {
    const next = extendComponents(
      base,
      { platform: { value: 'Linux x86_64', duration: 9 } },
      { overwrite: true },
    )
    expect(isValueComponent(next.platform)).toBe(true)
    if (isValueComponent(next.platform)) {
      expect(next.platform.value).toBe('Linux x86_64')
    }
  })

  it('withComponent adds a single entry without overwrite by default', () => {
    const next = withComponent(base, 'platform', { value: 'nope', duration: 0 })
    expect(isValueComponent(next.platform)).toBe(true)
    if (isValueComponent(next.platform)) {
      expect(next.platform.value).toBe('Win32')
    }
    const added = withComponent(base, 'extra', { value: true, duration: 1 })
    expect(isValueComponent(added.extra)).toBe(true)
  })

  it('accepts error components through extend and keeps hash/debug stable', () => {
    const withError = extendComponents(base, {
      boom: { error: new Error('collector failed'), duration: 5 },
    })
    expect(isErrorComponent(withError.boom)).toBe(true)
    const hashed = hashComponents(withError)
    expect(hashed).toMatch(/^[0-9a-f]{32}$/)
    expect(hashed).toBe(hashComponents(withError))
    const debug = componentsToDebugString(withError)
    expect(debug).toContain('boom')
    expect(debug).toMatch(/error|Error|collector failed/i)
  })

  it('types helpers as public UnknownComponents transforms', () => {
    expectTypeOf(omitComponents).parameter(0).toMatchTypeOf<UnknownComponents>()
    expectTypeOf(extendComponents).returns.toMatchTypeOf<UnknownComponents>()
    expectTypeOf(withComponent).returns.toMatchTypeOf<UnknownComponents>()
  })
})

describe('mergeBuiltinSources + excludeSources order', () => {
  it('appends custom sources after built-ins without overriding by default', () => {
    const custom: Record<string, Source<Opts, unknown>> = {
      platform: (() => 'hijack') as Source<Opts, string>,
      customLocaleProbe: (() => 'fa-IR') as Source<Opts, string>,
    }
    const merged = mergeBuiltinSources(custom)
    const keys = Object.keys(merged)
    expect(keys).toHaveLength(ENABLED_SOURCES.length + 1)
    expect(keys.slice(0, ENABLED_SOURCES.length)).toEqual([...ENABLED_SOURCES])
    expect(keys[keys.length - 1]).toBe('customLocaleProbe')
    expect(merged.platform).toBe(createBuiltinSources().platform)
  })

  it('overwriteBuiltins replaces colliding built-in keys', () => {
    const replacement = (() => 'CustomPlatform') as Source<Opts, string>
    const merged = mergeBuiltinSources(
      { platform: replacement },
      { overwriteBuiltins: true },
    )
    expect(merged.platform).toBe(replacement)
  })

  it('rejects excluded upstream payment key applePay', () => {
    expect(() =>
      mergeBuiltinSources({
        [EXCLUDED_UPSTREAM_SOURCE]: (() => 0) as Source<Opts, number>,
      }),
    ).toThrow(RegistryInvariantError)
  })

  it('excludeSources drops keys while preserving relative order of remaining', async () => {
    const sources = mergeBuiltinSources({
      customA: (() => 'a') as Source<Opts, string>,
      customB: (() => 'b') as Source<Opts, string>,
    })
    const exclude = ['fonts', 'customA', 'canvas'] as const
    const get = loadSources(sources, { cache: {}, debug: false }, exclude)
    const components = await get()
    const keys = Object.keys(components)
    expect(keys).not.toContain('fonts')
    expect(keys).not.toContain('customA')
    expect(keys).not.toContain('canvas')
    expect(keys).toContain('customB')
    expect(keys.indexOf('platform')).toBeLessThan(keys.indexOf('customB'))
    // excludes() helper: true means "keep" (item not in exclude list)
    expect(excludes(exclude, 'platform')).toBe(true)
    expect(excludes(exclude, 'fonts')).toBe(false)
  })

  it('load() wires customSources + excludeSources without browser when overridden', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      customSources: {
        customMark: (() => 1) as Source<Opts, number>,
        platform: (() => 'should-not-win') as Source<Opts, string>,
      },
      excludeSources: ['domBlockers'],
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).not.toContain('domBlockers')
    expect(Object.keys(result.components)).not.toContain('applePay')
    expect(result.components).toHaveProperty('customMark')
    // Default: custom must not override built-in platform.
    expect(isValueComponent(result.components.platform)).toBe(true)
    if (isValueComponent(result.components.platform)) {
      expect(result.components.platform.value).not.toBe('should-not-win')
    }
    expect(result.visitorId).toBe(hashComponents(result.components))
  })
})

describe('extension API safety', () => {
  it('contains no eval / new Function in extend and merge modules', () => {
    const files = [
      'packages/browser-sdk/src/components/extend.ts',
      'packages/browser-sdk/src/sources/merge-sources.ts',
      'packages/browser-sdk/src/agent.ts',
    ]
    for (const relative of files) {
      const source = readFileSync(join(root, relative), 'utf8')
      expect(source).not.toMatch(/\beval\s*\(/)
      expect(source).not.toMatch(/\bnew\s+Function\s*\(/)
      expect(source).not.toMatch(/\bFunction\s*\(\s*['"`]/)
    }
  })
})
