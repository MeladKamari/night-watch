import { errorToObject, isSensitiveKey, toError } from '@night-watch/core'

/**
 * Keys that identify the current page or session and must never appear in
 * diagnostic snapshots (direct user-identifying page context).
 */
export const FORBIDDEN_PAGE_CONTEXT_KEYS = [
  'href',
  'location',
  'locationHref',
  'pageUrl',
  'url',
  'documentURI',
  'URL',
  'title',
  'documentTitle',
  'referrer',
  'cookie',
  'cookies',
  'documentCookie',
  // Note: do NOT list entropy source names (localStorage/sessionStorage/indexedDB) —
  // those are valid component keys. Block storage *dumps* via dedicated field names:
  'localStorageDump',
  'sessionStorageDump',
  'indexedDBDump',
  'storageDump',
  'username',
  'email',
  'phone',
  'ip',
  'ipAddress',
] as const

const FORBIDDEN_SET = new Set<string>(
  FORBIDDEN_PAGE_CONTEXT_KEYS.map((k) => k.toLowerCase()),
)

const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/gi
const FILE_URL = /file:\/\/\/[^\s"'<>]+/gi

export function isForbiddenPageContextKey(key: string): boolean {
  if (isSensitiveKey(key)) return true
  return FORBIDDEN_SET.has(key.toLowerCase())
}

/** Strip absolute URLs / file paths from free-form strings (error messages, stacks). */
export function redactIdentifyingText(text: string): string {
  return text
    .replace(URL_IN_TEXT, '[url]')
    .replace(FILE_URL, '[file-url]')
}

export function redactErrorForDiagnostics(error: unknown): Record<string, unknown> {
  const obj = errorToObject(toError(error))
  return redactDeep(obj) as Record<string, unknown>
}

/**
 * Deep-redact plain JSON-like values: forbidden keys → `[redacted]`,
 * strings scrubbed of URLs. Does not invent component success values.
 */
export function redactDeep(value: unknown, keyHint = ''): unknown {
  if (keyHint && isForbiddenPageContextKey(keyHint)) {
    return '[redacted]'
  }
  if (value instanceof Error) {
    return redactErrorForDiagnostics(value)
  }
  if (typeof value === 'string') {
    return redactIdentifyingText(value)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item))
  }
  const input = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(input)) {
    if (isForbiddenPageContextKey(key)) {
      output[key] = '[redacted]'
      continue
    }
    output[key] = redactDeep(child, key)
  }
  return output
}

/** Returns paths of forbidden keys still present (for validation). */
export function findForbiddenPageContextKeys(
  value: unknown,
  path = '',
): string[] {
  if (value === null || typeof value !== 'object') {
    return []
  }
  if (Array.isArray(value)) {
    const nested: string[] = []
    for (let index = 0; index < value.length; index++) {
      nested.push(
        ...findForbiddenPageContextKeys(value[index], `${path}[${index}]`),
      )
    }
    return nested
  }
  const hits: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key
    if (isForbiddenPageContextKey(key) && child !== '[redacted]') {
      hits.push(next)
    }
    hits.push(...findForbiddenPageContextKeys(child, next))
  }
  return hits
}
