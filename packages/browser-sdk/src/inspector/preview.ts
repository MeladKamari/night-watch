import { isErrorComponent, isValueComponent, type Component } from '@night-watch/core'
import { redactDeep, redactErrorForDiagnostics } from '../diagnostics/redact.js'

export function armOf(component: Component<unknown> | undefined): 'value' | 'error' | 'missing' {
  if (component === undefined) return 'missing'
  if (isValueComponent(component)) return 'value'
  if (isErrorComponent(component)) return 'error'
  return 'missing'
}

/**
 * Privacy-safe, stable preview for display — redacts secrets/URLs and truncates.
 */
export function previewComponent(
  component: Component<unknown> | undefined,
  maxLength: number,
): string | null {
  if (component === undefined) return null
  if (isErrorComponent(component)) {
    const redacted = redactErrorForDiagnostics(component.error)
    return truncate(stableStringify(redacted), maxLength)
  }
  if (isValueComponent(component)) {
    return truncate(stableStringify(redactDeep(component.value)), maxLength)
  }
  return truncate('[unrecognized component]', maxLength)
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

/** Deterministic JSON for previews (sorted object keys). Always a string. */
export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }
  const encoded = JSON.stringify(sortKeysDeep(value))
  // JSON.stringify can return undefined for some exotic values; never return that.
  return encoded === undefined ? 'null' : encoded
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  const input = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(input).sort()) {
    out[key] = sortKeysDeep(input[key])
  }
  return out
}
