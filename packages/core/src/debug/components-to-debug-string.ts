import { errorToObject, isSensitiveKey } from '../errors/error-to-object.js'
import type { UnknownComponents } from '../types.js'

/**
 * Pretty-prints components for local debugging.
 * `Error` instances (including `DOMException`) are converted via {@link errorToObject}.
 * Credential-like keys are replaced with `'[redacted]'`.
 * Does not perform network I/O or write to persistent storage.
 */
export function componentsToDebugString(components: UnknownComponents): string {
  return JSON.stringify(
    components,
    (key, value: unknown) => {
      if (typeof key === 'string' && key.length > 0 && isSensitiveKey(key)) {
        return '[redacted]'
      }
      if (value instanceof Error) {
        return errorToObject(value)
      }
      return value
    },
    2,
  )
}
