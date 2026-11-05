const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|secret|token|authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)$/i

/** True for credential-like property names that must not appear in debug dumps. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key)
}

function redactSensitiveFields(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) {
      output[key] = '[redacted]'
      continue
    }
    output[key] = value
  }
  return output
}

/**
 * Converts an `Error` into a plain object suitable for `JSON.stringify`.
 * (`JSON.stringify(error)` alone yields `'{}'` because fields are non-enumerable.)
 *
 * Deviation from upstream: known credential-like own properties are replaced with
 * `'[redacted]'` so debug dumps do not leak secrets.
 */
export function errorToObject(error: Readonly<Error>): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n'),
    // Own enumerable fields (custom props). Non-enumerable Error fields are set above.
    ...(error as unknown as Record<string, unknown>),
  }
  return redactSensitiveFields(raw)
}

/**
 * Normalizes unknown thrown values into an `Error` for logging/debug paths.
 * Does not replace the raw `component.error` stored by collectors.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }
  if (typeof value === 'string') {
    return new Error(value)
  }
  try {
    return new Error(JSON.stringify(value))
  } catch {
    return new Error(String(value))
  }
}
