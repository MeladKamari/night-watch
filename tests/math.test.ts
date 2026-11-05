import {
  MATH_FINGERPRINT_KEYS,
  collectMathFingerprint,
  componentsToCanonicalString,
  createBuiltinSources,
  getMath,
  getMathValue,
  hashComponents,
  isValueComponent,
  load,
  type MathFingerprint,
  type MathLike,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('collectMathFingerprint / getMathValue', () => {
  it('returns locked named numeric samples with all keys', () => {
    const value = getMathValue()
    expect(Object.keys(value)).toEqual([...MATH_FINGERPRINT_KEYS])
    for (const key of MATH_FINGERPRINT_KEYS) {
      expect(typeof value[key]).toBe('number')
    }
  })

  it('is reproducible across repeated calls', () => {
    expect(getMathValue()).toEqual(getMathValue())
  })

  it('missing Math functions fall back to 0 for native probes', () => {
    const stub: MathLike = {
      PI: Math.PI,
      pow: Math.pow.bind(Math),
      log: Math.log.bind(Math),
      sqrt: Math.sqrt.bind(Math),
      exp: Math.exp.bind(Math),
      // acos / sin / etc. omitted → 0
    }
    const value = collectMathFingerprint(stub)
    expect(value.acos).toBe(0)
    expect(value.sin).toBe(0)
    expect(value.tan).toBe(0)
    // Polyfills still run via pow/log/sqrt/exp
    expect(Number.isFinite(value.powPI) || Number.isNaN(value.powPI)).toBe(true)
    expect(value.expm1Pf).toBe(Math.exp(1) - 1)
  })

  it('preserves -0 from sin/tan of large negative where the engine yields it', () => {
    const value = getMathValue()
    // Some engines return -0; Object.is distinguishes from +0.
    expect(typeof value.sin).toBe('number')
    expect(typeof value.tan).toBe('number')
    // Must not coerce -0 → 0 before hashing.
    const again = getMathValue()
    expect(Object.is(value.sin, again.sin)).toBe(true)
    expect(Object.is(value.tan, again.tan)).toBe(true)
  })

  it('can surface NaN / Infinity from hostile Math injects without inventing values', () => {
    const hostile: MathLike = {
      PI: Math.PI,
      pow: () => Number.POSITIVE_INFINITY,
      log: () => Number.NaN,
      sqrt: () => Number.NaN,
      exp: () => Number.POSITIVE_INFINITY,
      acos: () => Number.NaN,
      sin: () => Number.NEGATIVE_INFINITY,
    }
    const value = collectMathFingerprint(hostile)
    expect(Number.isNaN(value.acos)).toBe(true)
    expect(value.sin).toBe(Number.NEGATIVE_INFINITY)
    expect(value.powPI).toBe(Number.POSITIVE_INFINITY)
  })

  it('null math inject still returns a full key map', () => {
    const value = getMathValue({ math: null })
    expect(Object.keys(value)).toEqual([...MATH_FINGERPRINT_KEYS])
    expect(value.acos).toBe(0)
  })

  it('hashes deterministically for the live fingerprint object', () => {
    const value = getMathValue()
    const a = hashComponents({ math: { value, duration: 1 } })
    const b = hashComponents({ math: { value: getMathValue(), duration: 1 } })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(
      componentsToCanonicalString({
        math: { value, duration: 1 },
      }),
    ).toContain('math:')
  })
})

describe('builtin math wiring', () => {
  it('wires math as source #34; Node yields a full numeric map', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[33]).toBe('math')
    expect(sources.math).toBe(getMath)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.math)).toBe(true)
    if (isValueComponent(result.components.math)) {
      const value = result.components.math.value as MathFingerprint
      expect(Object.keys(value)).toEqual([...MATH_FINGERPRINT_KEYS])
      expect(typeof value.acos).toBe('number')
    }
  })
})
