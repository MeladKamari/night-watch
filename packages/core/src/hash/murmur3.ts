/*
 * MurmurHash3 x64 128-bit.
 * Based on https://github.com/karanlyons/murmurHash3.js/blob/a33d0723127e2e5415056c455f8aed2451ace208/murmurHash3.js
 * Observable behavior aligned with FingerprintJS OSS v5.3.0 `x64hash128`.
 */

import { getUTF8Bytes } from './utf8.js'

function byteAt(key: Uint8Array, index: number): number {
  return key[index] ?? 0
}

/** Adds two 64-bit values (tuples of 32-bit values); mutates `m`. */
function x64Add(m: number[], n: number[]): void {
  const m0 = (m[0] ?? 0) >>> 16
  const m1 = (m[0] ?? 0) & 0xffff
  const m2 = (m[1] ?? 0) >>> 16
  const m3 = (m[1] ?? 0) & 0xffff

  const n0 = (n[0] ?? 0) >>> 16
  const n1 = (n[0] ?? 0) & 0xffff
  const n2 = (n[1] ?? 0) >>> 16
  const n3 = (n[1] ?? 0) & 0xffff

  let o0 = 0
  let o1 = 0
  let o2 = 0
  let o3 = 0
  o3 += m3 + n3
  o2 += o3 >>> 16
  o3 &= 0xffff
  o2 += m2 + n2
  o1 += o2 >>> 16
  o2 &= 0xffff
  o1 += m1 + n1
  o0 += o1 >>> 16
  o1 &= 0xffff
  o0 += m0 + n0
  o0 &= 0xffff

  m[0] = (o0 << 16) | o1
  m[1] = (o2 << 16) | o3
}

/** Multiplies two 64-bit values; mutates `m`. */
function x64Multiply(m: number[], n: number[]): void {
  const m0 = (m[0] ?? 0) >>> 16
  const m1 = (m[0] ?? 0) & 0xffff
  const m2 = (m[1] ?? 0) >>> 16
  const m3 = (m[1] ?? 0) & 0xffff

  const n0 = (n[0] ?? 0) >>> 16
  const n1 = (n[0] ?? 0) & 0xffff
  const n2 = (n[1] ?? 0) >>> 16
  const n3 = (n[1] ?? 0) & 0xffff
  let o0 = 0
  let o1 = 0
  let o2 = 0
  let o3 = 0

  o3 += m3 * n3
  o2 += o3 >>> 16
  o3 &= 0xffff
  o2 += m2 * n3
  o1 += o2 >>> 16
  o2 &= 0xffff
  o2 += m3 * n2
  o1 += o2 >>> 16
  o2 &= 0xffff
  o1 += m1 * n3
  o0 += o1 >>> 16
  o1 &= 0xffff
  o1 += m2 * n2
  o0 += o1 >>> 16
  o1 &= 0xffff
  o1 += m3 * n1
  o0 += o1 >>> 16
  o1 &= 0xffff
  o0 += m0 * n3 + m1 * n2 + m2 * n1 + m3 * n0
  o0 &= 0xffff

  m[0] = (o0 << 16) | o1
  m[1] = (o2 << 16) | o3
}

/** Left-rotates a 64-bit value; mutates `m`. */
function x64Rotl(m: number[], bits: number): void {
  const m0 = m[0] ?? 0
  bits %= 64
  if (bits === 32) {
    m[0] = m[1] ?? 0
    m[1] = m0
  } else if (bits < 32) {
    m[0] = (m0 << bits) | ((m[1] ?? 0) >>> (32 - bits))
    m[1] = ((m[1] ?? 0) << bits) | (m0 >>> (32 - bits))
  } else {
    bits -= 32
    m[0] = ((m[1] ?? 0) << bits) | (m0 >>> (32 - bits))
    m[1] = (m0 << bits) | ((m[1] ?? 0) >>> (32 - bits))
  }
}

/** Left-shifts a value shaped as `[0, int32]`; mutates `m`. */
function x64LeftShift(m: number[], bits: number): void {
  bits %= 64
  if (bits === 0) {
    return
  } else if (bits < 32) {
    m[0] = (m[1] ?? 0) >>> (32 - bits)
    m[1] = (m[1] ?? 0) << bits
  } else {
    m[0] = (m[1] ?? 0) << (bits - 32)
    m[1] = 0
  }
}

function x64Xor(m: number[], n: number[]): void {
  m[0] = (m[0] ?? 0) ^ (n[0] ?? 0)
  m[1] = (m[1] ?? 0) ^ (n[1] ?? 0)
}

const F1 = [0xff51afd7, 0xed558ccd]
const F2 = [0xc4ceb9fe, 0x1a85ec53]

function x64Fmix(h: number[]): void {
  const shifted = [0, (h[0] ?? 0) >>> 1]
  x64Xor(h, shifted)
  x64Multiply(h, F1)
  shifted[1] = (h[0] ?? 0) >>> 1
  x64Xor(h, shifted)
  x64Multiply(h, F2)
  shifted[1] = (h[0] ?? 0) >>> 1
  x64Xor(h, shifted)
}

const C1 = [0x87c37b91, 0x114253d5]
const C2 = [0x4cf5ad43, 0x2745937f]
const M = [0, 5]
const N1 = [0, 0x52dce729]
const N2 = [0, 0x38495ab5]

/**
 * MurmurHash3 x64 128-bit as a 32-char lowercase hex string.
 */
export function x64hash128(input: string, seed = 0): string {
  const key = getUTF8Bytes(input)
  const length = [0, key.length]
  const remainder = length[1]! % 16
  const bytes = length[1]! - remainder
  const h1 = [0, seed]
  const h2 = [0, seed]
  const k1 = [0, 0]
  const k2 = [0, 0]

  let i: number
  for (i = 0; i < bytes; i = i + 16) {
    k1[0] =
      byteAt(key, i + 4) |
      (byteAt(key, i + 5) << 8) |
      (byteAt(key, i + 6) << 16) |
      (byteAt(key, i + 7) << 24)
    k1[1] =
      byteAt(key, i) |
      (byteAt(key, i + 1) << 8) |
      (byteAt(key, i + 2) << 16) |
      (byteAt(key, i + 3) << 24)
    k2[0] =
      byteAt(key, i + 12) |
      (byteAt(key, i + 13) << 8) |
      (byteAt(key, i + 14) << 16) |
      (byteAt(key, i + 15) << 24)
    k2[1] =
      byteAt(key, i + 8) |
      (byteAt(key, i + 9) << 8) |
      (byteAt(key, i + 10) << 16) |
      (byteAt(key, i + 11) << 24)

    x64Multiply(k1, C1)
    x64Rotl(k1, 31)
    x64Multiply(k1, C2)
    x64Xor(h1, k1)
    x64Rotl(h1, 27)
    x64Add(h1, h2)
    x64Multiply(h1, M)
    x64Add(h1, N1)
    x64Multiply(k2, C2)
    x64Rotl(k2, 33)
    x64Multiply(k2, C1)
    x64Xor(h2, k2)
    x64Rotl(h2, 31)
    x64Add(h2, h1)
    x64Multiply(h2, M)
    x64Add(h2, N2)
  }

  k1[0] = 0
  k1[1] = 0
  k2[0] = 0
  k2[1] = 0
  const val = [0, 0]
  // Equivalent to the upstream intentional switch fallthrough for the tail bytes.
  if (remainder >= 15) {
    val[1] = byteAt(key, i + 14)
    x64LeftShift(val, 48)
    x64Xor(k2, val)
  }
  if (remainder >= 14) {
    val[1] = byteAt(key, i + 13)
    x64LeftShift(val, 40)
    x64Xor(k2, val)
  }
  if (remainder >= 13) {
    val[1] = byteAt(key, i + 12)
    x64LeftShift(val, 32)
    x64Xor(k2, val)
  }
  if (remainder >= 12) {
    val[1] = byteAt(key, i + 11)
    x64LeftShift(val, 24)
    x64Xor(k2, val)
  }
  if (remainder >= 11) {
    val[1] = byteAt(key, i + 10)
    x64LeftShift(val, 16)
    x64Xor(k2, val)
  }
  if (remainder >= 10) {
    val[1] = byteAt(key, i + 9)
    x64LeftShift(val, 8)
    x64Xor(k2, val)
  }
  if (remainder >= 9) {
    val[1] = byteAt(key, i + 8)
    x64Xor(k2, val)
    x64Multiply(k2, C2)
    x64Rotl(k2, 33)
    x64Multiply(k2, C1)
    x64Xor(h2, k2)
  }
  if (remainder >= 8) {
    val[1] = byteAt(key, i + 7)
    x64LeftShift(val, 56)
    x64Xor(k1, val)
  }
  if (remainder >= 7) {
    val[1] = byteAt(key, i + 6)
    x64LeftShift(val, 48)
    x64Xor(k1, val)
  }
  if (remainder >= 6) {
    val[1] = byteAt(key, i + 5)
    x64LeftShift(val, 40)
    x64Xor(k1, val)
  }
  if (remainder >= 5) {
    val[1] = byteAt(key, i + 4)
    x64LeftShift(val, 32)
    x64Xor(k1, val)
  }
  if (remainder >= 4) {
    val[1] = byteAt(key, i + 3)
    x64LeftShift(val, 24)
    x64Xor(k1, val)
  }
  if (remainder >= 3) {
    val[1] = byteAt(key, i + 2)
    x64LeftShift(val, 16)
    x64Xor(k1, val)
  }
  if (remainder >= 2) {
    val[1] = byteAt(key, i + 1)
    x64LeftShift(val, 8)
    x64Xor(k1, val)
  }
  if (remainder >= 1) {
    val[1] = byteAt(key, i)
    x64Xor(k1, val)
    x64Multiply(k1, C1)
    x64Rotl(k1, 31)
    x64Multiply(k1, C2)
    x64Xor(h1, k1)
  }

  x64Xor(h1, length)
  x64Xor(h2, length)
  x64Add(h1, h2)
  x64Add(h2, h1)
  x64Fmix(h1)
  x64Fmix(h2)
  x64Add(h1, h2)
  x64Add(h2, h1)

  return (
    `00000000${((h1[0] ?? 0) >>> 0).toString(16)}`.slice(-8) +
    `00000000${((h1[1] ?? 0) >>> 0).toString(16)}`.slice(-8) +
    `00000000${((h2[0] ?? 0) >>> 0).toString(16)}`.slice(-8) +
    `00000000${((h2[1] ?? 0) >>> 0).toString(16)}`.slice(-8)
  )
}
