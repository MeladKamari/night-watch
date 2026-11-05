import {
  COMPONENT_ERROR_HASH_SENTINEL,
  type UnknownComponents,
} from '@night-watch/core'
import type { ComponentSnapshot } from './types.js'

/**
 * Builds a duration-free snapshot of one component for differential comparison.
 * Error payloads are reduced to the hash sentinel (same as canonicalization).
 */
export function snapshotComponent(component: unknown): ComponentSnapshot | undefined {
  if (!component || typeof component !== 'object') {
    return undefined
  }
  const record = component as { value?: unknown; error?: unknown; duration?: unknown }
  if ('error' in record) {
    return {
      kind: 'error',
      summary: summarizeError(record.error),
      hashToken: COMPONENT_ERROR_HASH_SENTINEL,
    }
  }
  if ('value' in record) {
    return {
      kind: 'value',
      summary: summarizeValue(record.value),
      hashToken: stableJson(record.value),
    }
  }
  return undefined
}

export function snapshotComponents(
  components: UnknownComponents | Record<string, unknown>,
): Record<string, ComponentSnapshot> {
  const out: Record<string, ComponentSnapshot> = {}
  for (const key of Object.keys(components)) {
    const snap = snapshotComponent(components[key])
    if (snap) {
      out[key] = snap
    }
  }
  return out
}

function summarizeValue(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return text === undefined ? 'undefined' : text.length > 200 ? `${text.slice(0, 199)}…` : text
  } catch {
    return String(value)
  }
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 200)
  }
  try {
    return JSON.stringify(error)?.slice(0, 200) ?? 'error'
  } catch {
    return String(error)
  }
}

function stableJson(value: unknown): string {
  const text = JSON.stringify(value)
  return text === undefined ? 'undefined' : text
}
