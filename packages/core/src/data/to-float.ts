/** `parseInt` wrapper — may return NaN. Aligned with FingerprintJS OSS v5.3.0 `toInt`. */
export function toInt(value: unknown): number {
  return parseInt(value as string)
}

/** `parseFloat` wrapper — may return NaN. Aligned with FingerprintJS OSS v5.3.0 `toFloat`. */
export function toFloat(value: unknown): number {
  return parseFloat(value as string)
}

/** Replaces NaN with `replacement`. Aligned with FingerprintJS OSS v5.3.0 `replaceNaN`. */
export function replaceNaN<T, U>(value: T, replacement: U): T | U {
  return typeof value === 'number' && Number.isNaN(value) ? replacement : value
}
