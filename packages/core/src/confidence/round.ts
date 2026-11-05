/**
 * Rounds `value` to the nearest multiple of `base`.
 * Matches FingerprintJS OSS v5.3.0 `round` (used for derived confidence display).
 */
export function round(value: number, base = 1): number {
  if (Math.abs(base) >= 1) {
    return Math.round(value / base) * base
  }
  const counterBase = 1 / base
  return Math.round(value * counterBase) / counterBase
}
