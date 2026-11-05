import { type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Fallback when a native Math method is missing (older engines). */
const fallbackFn = (): number => 0

/**
 * Locked output keys (v5.3.0 order). Changing keys/inputs requires a new algorithm revision.
 *
 * @see https://gitlab.torproject.org/legacy/trac/-/issues/13018
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=531915
 */
export const MATH_FINGERPRINT_KEYS = [
  'acos',
  'acosh',
  'acoshPf',
  'asin',
  'asinh',
  'asinhPf',
  'atanh',
  'atanhPf',
  'atan',
  'sin',
  'sinh',
  'sinhPf',
  'cos',
  'cosh',
  'coshPf',
  'tan',
  'tanh',
  'tanhPf',
  'exp',
  'expm1',
  'expm1Pf',
  'log1p',
  'log1pPf',
  'powPI',
] as const

export type MathFingerprintKey = (typeof MATH_FINGERPRINT_KEYS)[number]

export type MathFingerprint = Record<MathFingerprintKey, number>

/** Minimal Math surface used by the probes (native + polyfill building blocks). */
export type MathLike = {
  readonly PI: number
  acos?: (x: number) => number
  acosh?: (x: number) => number
  asin?: (x: number) => number
  asinh?: (x: number) => number
  atanh?: (x: number) => number
  atan?: (x: number) => number
  sin?: (x: number) => number
  sinh?: (x: number) => number
  cos?: (x: number) => number
  cosh?: (x: number) => number
  tan?: (x: number) => number
  tanh?: (x: number) => number
  /** Used by native probe (with fallback) and by polyfills (direct call). */
  exp: (x: number) => number
  expm1?: (x: number) => number
  log1p?: (x: number) => number
  pow: (x: number, y: number) => number
  log: (x: number) => number
  sqrt: (x: number) => number
}

export type MathOptions = {
  /** Inject Math-like object for tests (skips live `Math`). */
  math?: MathLike | null
}

/**
 * Computes fixed high-precision Math probes + comparison polyfills.
 * Returns named numeric samples; missing native methods fall back to `0`.
 * Does not round or stringify results (avoids serialization loss before hashing).
 */
export function getMathValue(options: MathOptions = {}): MathFingerprint {
  if ('math' in options) {
    if (options.math == null) {
      // No Math object — still return a full key map via pure fallbacks where possible.
      return collectMathFingerprint(createEmptyMath())
    }
    return collectMathFingerprint(options.math)
  }
  return collectMathFingerprint(Math as MathLike)
}

export function collectMathFingerprint(M: MathLike): MathFingerprint {
  // Native operations (missing → constant 0)
  const acos = M.acos || fallbackFn
  const acosh = M.acosh || fallbackFn
  const asin = M.asin || fallbackFn
  const asinh = M.asinh || fallbackFn
  const atanh = M.atanh || fallbackFn
  const atan = M.atan || fallbackFn
  const sin = M.sin || fallbackFn
  const sinh = M.sinh || fallbackFn
  const cos = M.cos || fallbackFn
  const cosh = M.cosh || fallbackFn
  const tan = M.tan || fallbackFn
  const tanh = M.tanh || fallbackFn
  const exp = M.exp || fallbackFn
  const expm1 = M.expm1 || fallbackFn
  const log1p = M.log1p || fallbackFn

  // Operation polyfills (must match upstream operator precedence quirks).
  // Polyfills call M.exp/log/sqrt/pow directly (not the native fallbacks), same as v5.3.0.
  const powPI = (value: number) => M.pow(M.PI, value)
  const acoshPf = (value: number) => M.log(value + M.sqrt(value * value - 1))
  const asinhPf = (value: number) => M.log(value + M.sqrt(value * value + 1))
  const atanhPf = (value: number) => M.log((1 + value) / (1 - value)) / 2
  // Intentionally NOT the textbook sinh: mirrors v5.3.0 `exp - 1/exp/2` precedence.
  const sinhPf = (value: number) => M.exp(value) - 1 / M.exp(value) / 2
  const coshPf = (value: number) => (M.exp(value) + 1 / M.exp(value)) / 2
  const expm1Pf = (value: number) => M.exp(value) - 1
  const tanhPf = (value: number) => (M.exp(2 * value) - 1) / (M.exp(2 * value) + 1)
  const log1pPf = (value: number) => M.log(1 + value)

  // Constant values are empirical (v5.3.0)
  return {
    acos: acos(0.123124234234234242),
    acosh: acosh(1e308),
    acoshPf: acoshPf(1e154), // 1e308 will not work for polyfill
    asin: asin(0.123124234234234242),
    asinh: asinh(1),
    asinhPf: asinhPf(1),
    atanh: atanh(0.5),
    atanhPf: atanhPf(0.5),
    atan: atan(0.5),
    sin: sin(-1e300),
    sinh: sinh(1),
    sinhPf: sinhPf(1),
    cos: cos(10.000000000123),
    cosh: cosh(1),
    coshPf: coshPf(1),
    tan: tan(-1e300),
    tanh: tanh(1),
    tanhPf: tanhPf(1),
    exp: exp(1),
    expm1: expm1(1),
    expm1Pf: expm1Pf(1),
    log1p: log1p(10),
    log1pPf: log1pPf(10),
    powPI: powPI(-100),
  }
}

function createEmptyMath(): MathLike {
  return {
    PI: Math.PI,
    pow: () => 0,
    log: () => 0,
    sqrt: () => 0,
    exp: () => 0,
  }
}

/** Entropy source: floating-point Math fingerprint samples. */
export const getMath: Source<BuiltinSourceOptions, MathFingerprint> = () => getMathValue()
