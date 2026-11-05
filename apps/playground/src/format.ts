/**
 * Display helpers for the playground.
 * Never mutate values that feed `hashComponents` / visitorId.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹' as const

/** Map ASCII digits to Persian digits for UI labels only. */
export function toPersianDigits(input: string): string {
  return input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit)
}

/** Keep Latin digits for hashed identifiers and machine-readable diagnostics. */
export function formatLatinNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) {
    return String(value)
  }
  return value.toFixed(fractionDigits)
}

/**
 * Dual display: Latin (canonical for diagnostics) + Persian digits (UI).
 * Does not alter the underlying numeric / hash values.
 */
export function formatDualNumber(value: number, fractionDigits = 0): { latin: string; persian: string } {
  const latin = formatLatinNumber(value, fractionDigits)
  return { latin, persian: toPersianDigits(latin) }
}

const SUMMARY_MAX = 240

/** Human-readable one-line summary; truncates large payloads. */
export function summarizeValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return truncate(JSON.stringify(value))
  }
  try {
    return truncate(JSON.stringify(value))
  } catch {
    return truncate(String(value))
  }
}

export function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name || 'Error'
    const message = error.message || '(no message)'
    return truncate(`${name}: ${message}`)
  }
  if (typeof error === 'string') {
    return truncate(error)
  }
  try {
    return truncate(JSON.stringify(error))
  } catch {
    return truncate(String(error))
  }
}

function truncate(text: string): string {
  if (text.length <= SUMMARY_MAX) {
    return text
  }
  return `${text.slice(0, SUMMARY_MAX - 1)}…`
}
