import {
  BaseLatencySpecialFingerprint,
  closeAudioContext,
  componentsToCanonicalString,
  createBuiltinSources,
  getAudioBaseLatency,
  getAudioBaseLatencyValue,
  hashComponents,
  isAudioBaseLatencyPlatformAllowed,
  isValueComponent,
  load,
  type AudioContextWithBaseLatency,
  type AudioContextWithBaseLatencyConstructor,
} from '@night-watch/browser-sdk'
import { describe, expect, it, vi } from 'vitest'

function mockCtor(
  baseLatency: number | null | undefined,
  closeImpl?: () => void,
): AudioContextWithBaseLatencyConstructor {
  return class {
    get baseLatency() {
      return baseLatency
    }
    close = closeImpl
  }
}

describe('getAudioBaseLatencyValue', () => {
  it('returns Disabled when platform is not Android/WebKit (avoids console warnings)', () => {
    expect(
      getAudioBaseLatencyValue({ allowPlatform: false, audioContext: mockCtor(0.01) }),
    ).toBe(BaseLatencySpecialFingerprint.Disabled)
  })

  it('returns NotSupported when AudioContext missing or baseLatency nullish', () => {
    expect(
      getAudioBaseLatencyValue({ allowPlatform: true, audioContext: null }),
    ).toBe(BaseLatencySpecialFingerprint.NotSupported)
    expect(
      getAudioBaseLatencyValue({ allowPlatform: true, audioContext: mockCtor(null) }),
    ).toBe(BaseLatencySpecialFingerprint.NotSupported)
    expect(
      getAudioBaseLatencyValue({ allowPlatform: true, audioContext: mockCtor(undefined) }),
    ).toBe(BaseLatencySpecialFingerprint.NotSupported)
  })

  it('returns NotFinite for Infinity and NaN', () => {
    expect(
      getAudioBaseLatencyValue({
        allowPlatform: true,
        audioContext: mockCtor(Number.POSITIVE_INFINITY),
      }),
    ).toBe(BaseLatencySpecialFingerprint.NotFinite)
    expect(
      getAudioBaseLatencyValue({ allowPlatform: true, audioContext: mockCtor(Number.NaN) }),
    ).toBe(BaseLatencySpecialFingerprint.NotFinite)
  })

  it('returns finite baseLatency and closes the context', () => {
    const close = vi.fn()
    const value = getAudioBaseLatencyValue({
      allowPlatform: true,
      audioContext: mockCtor(0.012, close),
    })
    expect(value).toBe(0.012)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes even when baseLatency is non-finite', () => {
    const close = vi.fn()
    getAudioBaseLatencyValue({
      allowPlatform: true,
      audioContext: mockCtor(Number.POSITIVE_INFINITY, close),
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closeAudioContext tolerates missing / throwing close', () => {
    expect(() => closeAudioContext(undefined)).not.toThrow()
    expect(() => closeAudioContext({ baseLatency: 0 })).not.toThrow()
    expect(() =>
      closeAudioContext({
        baseLatency: 0,
        close() {
          throw new Error('close failed')
        },
      }),
    ).not.toThrow()
  })

  it('Node default path is Disabled or NotSupported (never invents latency)', () => {
    const value = getAudioBaseLatencyValue()
    // Node is neither Android nor WebKit → Disabled; if allow somehow, no AudioContext → NotSupported
    expect([
      BaseLatencySpecialFingerprint.Disabled,
      BaseLatencySpecialFingerprint.NotSupported,
    ]).toContain(value)
    expect(typeof isAudioBaseLatencyPlatformAllowed()).toBe('boolean')
  })
})

describe('builtin audioBaseLatency wiring', () => {
  it('wires audioBaseLatency as source #38', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[37]).toBe('audioBaseLatency')
    expect(sources.audioBaseLatency).toBe(getAudioBaseLatency)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.audioBaseLatency)).toBe(true)
    if (isValueComponent(result.components.audioBaseLatency)) {
      expect(typeof result.components.audioBaseLatency.value).toBe('number')
      expect([
        BaseLatencySpecialFingerprint.Disabled,
        BaseLatencySpecialFingerprint.NotSupported,
      ]).toContain(result.components.audioBaseLatency.value)
    }

    expect(
      componentsToCanonicalString({
        audioBaseLatency: { value: BaseLatencySpecialFingerprint.Disabled, duration: 1 },
      }),
    ).toContain('audioBaseLatency:')
    expect(
      hashComponents({
        audioBaseLatency: { value: BaseLatencySpecialFingerprint.NotFinite, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('AudioContextWithBaseLatency type smoke', () => {
  it('accepts sync and async close shapes', () => {
    const sync: AudioContextWithBaseLatency = {
      baseLatency: 0.01,
      close: () => undefined,
    }
    const asyncClose: AudioContextWithBaseLatency = {
      baseLatency: 0.01,
      close: () => Promise.resolve(),
    }
    expect(sync.baseLatency).toBe(0.01)
    expect(asyncClose.baseLatency).toBe(0.01)
  })
})
