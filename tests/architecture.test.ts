import {
  collectArchitecture,
  componentsToCanonicalString,
  createBuiltinSources,
  getArchitecture,
  getArchitectureValue,
  hashComponents,
  isValueComponent,
  load,
  resolveNativeTypedArrays,
  type ArchitectureTypedArrays,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('collectArchitecture / getArchitectureValue', () => {
  it('returns 127 or 255 on live little-endian hosts (NaN sign-bit clue)', () => {
    const value = getArchitectureValue()
    expect([127, 255]).toContain(value)
  })

  it('is stable across repeated calls', () => {
    expect(getArchitectureValue()).toBe(getArchitectureValue())
  })

  it('typed arrays unavailable → undefined (never invent a byte)', () => {
    expect(getArchitectureValue({ arrays: null })).toBeUndefined()
    expect(collectArchitecture(undefined)).toBeUndefined()
    expect(collectArchitecture(null)).toBeUndefined()
  })

  it('byte-level fixture: custom buffer yields u8[3]', () => {
    // Little-endian layout: bytes [0,1,2,3]; probe returns index 3.
    const arrays: ArchitectureTypedArrays = {
      Float32Array: class {
        buffer: ArrayBuffer
        private view: Float32Array
        constructor(length: number) {
          this.view = new Float32Array(length)
          this.buffer = this.view.buffer
        }
        get [0]() {
          return this.view[0]!
        }
        set [0](v: number) {
          this.view[0] = v
        }
      },
      Uint8Array: class {
        length: number
        private view: Uint8Array
        constructor(buffer: ArrayBufferLike) {
          this.view = new Uint8Array(buffer)
          this.length = this.view.length
        }
        get [0]() {
          return this.view[0]!
        }
        get [1]() {
          return this.view[1]!
        }
        get [2]() {
          return this.view[2]!
        }
        get [3]() {
          return this.view[3]!
        }
      },
    }
    const viaInject = collectArchitecture(arrays)
    const viaNative = getArchitectureValue()
    expect(viaInject).toBe(viaNative)
    expect([127, 255]).toContain(viaInject)
  })

  it('endian assumption: Float32 ∞−∞ NaN puts sign/exponent in byte 3 on LE', () => {
    const f = new Float32Array(1)
    const u8 = new Uint8Array(f.buffer)
    f[0] = Infinity
    f[0] = f[0]! - f[0]!
    expect(Number.isNaN(f[0]!)).toBe(true)
    // On little-endian, byte 3 is the MSB (sign + top exponent bits).
    expect(u8[3]).toBe(getArchitectureValue())
    // Must not claim a CPU name
    expect(typeof getArchitectureValue()).toBe('number')
  })

  it('resolveNativeTypedArrays returns constructors when present', () => {
    const resolved = resolveNativeTypedArrays()
    expect(resolved).toBeDefined()
    expect(resolved?.Float32Array).toBe(Float32Array)
    expect(resolved?.Uint8Array).toBe(Uint8Array)
  })
})

describe('builtin architecture wiring', () => {
  it('wires architecture as source #36; Node yields 127|255', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[35]).toBe('architecture')
    expect(sources.architecture).toBe(getArchitecture)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.architecture)).toBe(true)
    if (isValueComponent(result.components.architecture)) {
      expect([127, 255]).toContain(result.components.architecture.value)
    }

    expect(
      componentsToCanonicalString({
        architecture: { value: 255, duration: 1 },
      }),
    ).toContain('architecture:')
    expect(
      hashComponents({
        architecture: { value: 255, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
    expect(
      hashComponents({ architecture: { value: 127, duration: 1 } }),
    ).not.toBe(hashComponents({ architecture: { value: 255, duration: 1 } }))
  })
})
