import {
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
  UnsupportedEnvironmentError,
  createBuiltinSources,
  handleMonitoringOption,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  prepareForSources,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type Source,
} from '@thenightwatch/browser-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Opts = BuiltinSourceOptions

function testSources(overrides: Partial<Record<string, Source<Opts, unknown>>> = {}): BuiltinSources {
  const base = createBuiltinSources()
  return { ...base, ...overrides } as BuiltinSources
}

describe('agent lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects load() under Node without browser overrides', async () => {
    await expect(load({ delayFallback: 0 })).rejects.toBeInstanceOf(UnsupportedEnvironmentError)
  })

  it('defaults monitoring to off and never opens network when monitoring true', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    handleMonitoringOption(false)
    handleMonitoringOption(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('prepareForSources resolves via fallback timeout', async () => {
    vi.useFakeTimers()
    const pending = prepareForSources(20)
    await vi.advanceTimersByTimeAsync(20)
    await expect(pending).resolves.toBeUndefined()
  })

  it('loads with allowNonBrowser + sources and returns visitorId/confidence/components/version', async () => {
    const sources = testSources({
      platform: (() => 'Win32') as Source<Opts, string>,
    })

    const agent = await load({
      delayFallback: 0,
      sources,
      allowNonBrowser: true,
    })

    const first = await agent.get()
    expect(first.version).toBe('1.0.0')
    expect(first.confidence.score).toBe(0.6)
    expect(first.confidence.comment).toMatch(/Not a calibrated probability/i)
    expect(Object.keys(first.components)).toHaveLength(41)
    expect(Object.keys(first.components)).not.toContain('applePay')
    expect(isValueComponent(first.components.platform)).toBe(true)
    expect(isErrorComponent(first.components.fonts)).toBe(true)
    if (isErrorComponent(first.components.fonts)) {
      // fonts is implemented but requires a browser DOM under Node.
      expect(first.components.fonts.error).toBeInstanceOf(UnsupportedEnvironmentError)
    }
    expect(isValueComponent(first.components.canvas)).toBe(true)
    if (isValueComponent(first.components.canvas)) {
      expect(first.components.canvas.value).toEqual({
        winding: false,
        geometry: 'unsupported',
        text: 'unsupported',
      })
    }
    expect(first.visitorId).toMatch(/^[0-9a-f]{32}$/)
    expect(first.visitorId).toBe(hashComponents(first.components))

    const second = await agent.get()
    expect(second.visitorId).toBe(first.visitorId)
  })

  it('debug logging is guarded and includes manifest revision', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const sources = createBuiltinSources()

    const quiet = await load({
      delayFallback: 0,
      sources,
      allowNonBrowser: true,
      debug: false,
    })
    await quiet.get()
    expect(log).not.toHaveBeenCalled()

    const noisy = await load({
      delayFallback: 0,
      sources,
      allowNonBrowser: true,
      debug: true,
    })
    const result = await noisy.get()
    expect(log).toHaveBeenCalled()
    const message = String(log.mock.calls[0]?.[0])
    expect(message).toContain('visitorId:')
    expect(message).toContain(result.visitorId)
    expect(message).toContain(SOURCE_MANIFEST_REVISION)

    log.mockClear()
    await quiet.get({ debug: true })
    expect(log).toHaveBeenCalled()
  })

  it('builtin registry has exactly 41 sources and no applePay', () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)).toEqual([...ENABLED_SOURCES])
    expect(sources).not.toHaveProperty('applePay')
  })

  it('default export exposes load/hashComponents/componentsToDebugString', async () => {
    const mod = await import('@thenightwatch/browser-sdk')
    expect(typeof mod.default.load).toBe('function')
    expect(typeof mod.default.hashComponents).toBe('function')
    expect(typeof mod.default.componentsToDebugString).toBe('function')
  })
})
