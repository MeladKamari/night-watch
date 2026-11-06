import { type BuiltinSourceOptions, type Source } from '@thenightwatch/core'

/**
 * Minimal typed-array surface for the architecture NaN probe.
 * Injection enables byte-level fixtures without inventing a CPU label.
 */
export type ArchitectureTypedArrays = {
  readonly Float32Array: new (length: number) => {
    buffer: ArrayBufferLike
    [index: number]: number
  }
  readonly Uint8Array: new (buffer: ArrayBufferLike) => {
    readonly length: number
    [index: number]: number
  }
}

export type ArchitectureOptions = {
  /**
   * Inject typed-array constructors for tests.
   * `null` simulates environments where typed arrays are unavailable.
   */
  arrays?: ArchitectureTypedArrays | null
}

/**
 * Coarse architecture clue from the sign bit of a produced NaN (∞ − ∞).
 *
 * On x86/x86-64, floating-point ops that produce NaN without NaN inputs often
 * set the sign bit; other ISAs often do not. This returns `u8[3]` of the
 * Float32 bit pattern — typically `255` or `127` on little-endian hosts.
 *
 * **Not** a precise CPU architecture, model, or hardware ID. Do not map the
 * byte to strings like `"x86"` / `"arm"` in product code.
 *
 * @see https://codebrowser.bddppq.com/pytorch/pytorch/third_party/XNNPACK/src/init.c.html#79
 */
export function getArchitectureValue(options: ArchitectureOptions = {}): number | undefined {
  if ('arrays' in options) {
    if (options.arrays == null) {
      return undefined
    }
    return collectArchitecture(options.arrays)
  }
  return collectArchitecture(resolveNativeTypedArrays())
}

/**
 * Resolves live Float32Array / Uint8Array, or `undefined` when unavailable.
 */
export function resolveNativeTypedArrays(): ArchitectureTypedArrays | undefined {
  if (typeof Float32Array === 'undefined' || typeof Uint8Array === 'undefined') {
    return undefined
  }
  return { Float32Array, Uint8Array }
}

/**
 * Runs ∞ − ∞ into a Float32 slot and returns byte index 3 of the shared buffer.
 * Returns `undefined` when constructors are missing.
 */
export function collectArchitecture(
  arrays: ArchitectureTypedArrays | null | undefined,
): number | undefined {
  if (arrays == null) {
    return undefined
  }
  const f = new arrays.Float32Array(1)
  const u8 = new arrays.Uint8Array(f.buffer)
  f[0] = Infinity
  f[0] = f[0] - f[0]
  return u8[3]
}

/** Entropy source: coarse FP NaN architecture clue (byte, not a CPU name). */
export const getArchitecture: Source<BuiltinSourceOptions, number | undefined> = () =>
  getArchitectureValue()
