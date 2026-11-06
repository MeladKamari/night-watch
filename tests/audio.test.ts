import {
  SpecialFingerprint,
  componentsToCanonicalString,
  createBuiltinSources,
  getAudioFingerprintValue,
  getHash,
  getUnstableAudioFingerprint,
  hashComponents,
  isValueComponent,
  load,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions } from '@thenightwatch/core'
import { describe, expect, it, vi } from 'vitest'

function makeOfflineAudioContextMock(opts: {
  state?: AudioContextState
  channelData?: Float32Array
  startRendering?: () => Promise<AudioBuffer> | void
  onConstruct?: () => void
}): new (
  numberOfChannels: number,
  length: number,
  sampleRate: number,
) => OfflineAudioContext {
  return class MockOfflineAudioContext {
    state: AudioContextState
    destination = {} as AudioDestinationNode
    oncomplete: ((ev: OfflineAudioCompletionEvent) => void) | null = null
    private channelData: Float32Array

    constructor(
      public numberOfChannels: number,
      public length: number,
      public sampleRate: number,
    ) {
      opts.onConstruct?.()
      this.state = opts.state ?? 'running'
      this.channelData =
        opts.channelData ??
        Float32Array.from({ length: Math.max(0, length) }, (_, i) => (i >= 4500 ? 0.01 : 0))
    }

    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect() {
          return this
        },
        start() {},
      } as unknown as OscillatorNode
    }

    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect() {
          return this
        },
      } as unknown as DynamicsCompressorNode
    }

    startRendering() {
      if (opts.startRendering) {
        return opts.startRendering.call(this)
      }
      const buffer = {
        getChannelData: () => this.channelData,
      } as unknown as AudioBuffer
      queueMicrotask(() => {
        this.oncomplete?.({ renderedBuffer: buffer } as OfflineAudioCompletionEvent)
      })
      return Promise.resolve(buffer)
    }
  } as unknown as new (
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ) => OfflineAudioContext
}

describe('SpecialFingerprint / getHash', () => {
  it('documents sentinel codes', () => {
    expect(SpecialFingerprint.KnownForSuspending).toBe(-1)
    expect(SpecialFingerprint.NotSupported).toBe(-2)
    expect(SpecialFingerprint.Timeout).toBe(-3)
    expect(SpecialFingerprint.KnownForAntifingerprinting).toBe(-4)
  })

  it('sums absolute samples', () => {
    expect(getHash(new Float32Array([0.5, -0.25, 0.25]))).toBe(1)
  })
})

describe('getAudioFingerprintValue', () => {
  it('returns NotSupported when OfflineAudioContext is absent', () => {
    expect(getAudioFingerprintValue({ offlineAudioContext: null })).toBe(
      SpecialFingerprint.NotSupported,
    )
  })

  it('returns KnownForAntifingerprinting when gated (Safari17-like)', () => {
    expect(
      getAudioFingerprintValue({
        performAntifingerprinting: true,
        offlineAudioContext: makeOfflineAudioContextMock({}),
      }),
    ).toBe(SpecialFingerprint.KnownForAntifingerprinting)
  })

  it('returns KnownForSuspending when gated (old mobile WebKit)', () => {
    expect(
      getUnstableAudioFingerprint({
        suspendAudioContext: true,
        offlineAudioContext: makeOfflineAudioContextMock({}),
        performAntifingerprinting: false,
      }),
    ).toBe(SpecialFingerprint.KnownForSuspending)
  })

  it('returns a deferred getter that resolves a finite hash (no speaker path)', async () => {
    let constructed = 0
    const stage = getAudioFingerprintValue({
      performAntifingerprinting: false,
      suspendAudioContext: false,
      offlineAudioContext: makeOfflineAudioContextMock({
        onConstruct: () => {
          constructed += 1
        },
        channelData: Float32Array.from({ length: 5000 }, (_, i) => (i >= 4500 ? 0.002 : 0)),
      }),
    })
    expect(typeof stage).toBe('function')
    expect(constructed).toBe(1)
    if (typeof stage !== 'function') {
      return
    }
    const value = await stage()
    expect(value).toBeGreaterThan(0)
    expect(Number.isFinite(value)).toBe(true)
  })

  it('maps suspended-after-retries to Timeout sentinel', async () => {
    vi.useFakeTimers()
    try {
      const stage = getUnstableAudioFingerprint({
        performAntifingerprinting: false,
        suspendAudioContext: false,
        isDocumentHidden: () => false,
        offlineAudioContext: makeOfflineAudioContextMock({
          state: 'suspended',
          startRendering() {
            return undefined
          },
        }),
      })
      expect(typeof stage).toBe('function')
      if (typeof stage !== 'function') {
        return
      }
      const pending = stage()
      await vi.advanceTimersByTimeAsync(500 * 3 + 50)
      await expect(pending).resolves.toBe(SpecialFingerprint.Timeout)
    } finally {
      vi.useRealTimers()
    }
  })

  it('loadSource records special codes as values, not errors', async () => {
    const getComponents = loadSource(
      (() => SpecialFingerprint.NotSupported) as (
        options: BuiltinSourceOptions,
      ) => number,
      { cache: {} },
    )
    const component = await getComponents()
    expect(isValueComponent(component)).toBe(true)
    if (isValueComponent(component)) {
      expect(component.value).toBe(-2)
    }
  })
})

describe('builtin audio wiring', () => {
  it('wires audio as source #5; Node yields NotSupported value', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[4]).toBe('audio')
    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.audio)).toBe(true)
    if (isValueComponent(result.components.audio)) {
      expect(result.components.audio.value).toBe(SpecialFingerprint.NotSupported)
    }
    expect(componentsToCanonicalString({ audio: result.components.audio })).toBe('audio:-2')
    expect(hashComponents({ audio: { value: -2, duration: 1 } })).toMatch(/^[0-9a-f]{32}$/)
  })
})
