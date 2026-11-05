import { x64hash128 } from '@night-watch/core'
import { DiagnosticsError } from './errors.js'

/**
 * Normalizes a reproducibility seed for lab fixtures.
 * Empty / whitespace-only seeds are rejected.
 */
export function normalizeReproSeed(seed: string): string {
  const trimmed = String(seed ?? '').trim()
  if (!trimmed) {
    throw new DiagnosticsError('reproSeed must be a non-empty string')
  }
  if (trimmed.length > 256) {
    throw new DiagnosticsError('reproSeed must be at most 256 characters')
  }
  return trimmed
}

/**
 * Stable hash of a repro seed for embedding in snapshots without echoing secrets.
 * Uses the same Murmur3 x64 128 helper as visitorId hashing (hex string).
 */
export function hashReproSeed(seed: string): string {
  return x64hash128(normalizeReproSeed(seed), 0)
}

/**
 * Derives a deterministic lab label from seed + namespace (test data only).
 * Not a visitorId substitute and not used by default `load()` / `hashComponents`.
 */
export function deriveReproLabel(seed: string, label: string): string {
  const normalizedLabel = String(label ?? '').trim()
  if (!normalizedLabel) {
    throw new DiagnosticsError('repro label must be a non-empty string')
  }
  return x64hash128(`${normalizeReproSeed(seed)}\u0000${normalizedLabel}`, 0)
}
