import { getDocument, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/** Cookie name used for the temporary first-party probe (not a persistent identifier). */
export const COOKIE_TEST_NAME = 'cookietest'

const COOKIE_SET = `${COOKIE_TEST_NAME}=1; SameSite=Strict;`
const COOKIE_CLEAR = `${COOKIE_TEST_NAME}=1; SameSite=Strict; expires=Thu, 01-Jan-1970 00:00:01 GMT`

/** Minimal document surface for cookie write/read/clear. */
export type DocumentWithCookie = {
  cookie: string
}

export type CookiesEnabledOptions = {
  /** Inject document-like object for tests (skips live `getDocument`). */
  document?: DocumentWithCookie | null
}

/**
 * Probes first-party cookie write capability with a temporary SameSite=Strict cookie,
 * then removes it. Does **not** trust `navigator.cookieEnabled`.
 *
 * Side effect: briefly writes then deletes `cookietest=1` on the current document.
 * SecurityError / sandboxed / data-URI contexts → `false`.
 */
export function getCookiesEnabledValue(options: CookiesEnabledOptions = {}): boolean {
  if ('document' in options) {
    return probeCookiesEnabled(options.document)
  }
  const docProbe = getDocument()
  if (docProbe.status !== 'ok') {
    return false
  }
  return probeCookiesEnabled(docProbe.value)
}

export function probeCookiesEnabled(
  documentLike: DocumentWithCookie | null | undefined,
): boolean {
  if (documentLike == null) {
    return false
  }

  let result = false
  try {
    documentLike.cookie = COOKIE_SET
    result = documentLike.cookie.indexOf(`${COOKIE_TEST_NAME}=`) !== -1
  } catch {
    result = false
  } finally {
    // Always attempt cleanup, including when set/read threw (required for failure paths).
    try {
      documentLike.cookie = COOKIE_CLEAR
    } catch {
      // Ignore cleanup failures (e.g. SecurityError still in effect).
    }
  }
  return result
}

/** Entropy source: first-party cookie write capability (temporary probe cookie). */
export const getCookiesEnabled: Source<BuiltinSourceOptions, boolean> = () =>
  getCookiesEnabledValue()
