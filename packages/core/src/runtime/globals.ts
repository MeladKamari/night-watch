import {
  blocked,
  isBlockedBrowserError,
  ok,
  probeError,
  runProbe,
  unsupported,
  type ProbeResult,
} from './probe.js'
import { isBrowserEnvironment } from './environment.js'

type BrowserGlobalBag = typeof globalThis & {
  window?: Window
  document?: Document
  navigator?: Navigator
  screen?: Screen
  Intl?: typeof Intl
  matchMedia?: typeof matchMedia
}

function browserGlobals(): BrowserGlobalBag {
  return globalThis as BrowserGlobalBag
}

/** On-demand `window` accessor. Never call at module top level. */
export function getWindow(): ProbeResult<Window> {
  if (!isBrowserEnvironment()) {
    return unsupported()
  }
  return runProbe(true, () => {
    const w = browserGlobals().window
    if (w == null || typeof w !== 'object') {
      throw new TypeError('window is not an object')
    }
    return w
  })
}

/** On-demand `document` accessor. */
export function getDocument(): ProbeResult<Document> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  return runProbe(true, () => {
    const doc = win.value.document ?? browserGlobals().document
    if (doc == null || typeof doc !== 'object') {
      throw new TypeError('document is unavailable')
    }
    // Touch a benign property to surface SecurityError in hostile contexts.
    void doc.nodeType
    return doc
  })
}

/** On-demand `navigator` accessor. */
export function getNavigator(): ProbeResult<Navigator> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  return runProbe(true, () => {
    const nav = win.value.navigator ?? browserGlobals().navigator
    if (nav == null || typeof nav !== 'object') {
      throw new TypeError('navigator is unavailable')
    }
    void nav.userAgent
    return nav
  })
}

/** On-demand `screen` accessor. */
export function getScreen(): ProbeResult<Screen> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  return runProbe(true, () => {
    const s = win.value.screen ?? browserGlobals().screen
    if (s == null || typeof s !== 'object') {
      throw new TypeError('screen is unavailable')
    }
    void s.width
    return s
  })
}

/** On-demand `Intl` accessor (may exist in Node as well). */
export function getIntl(): ProbeResult<typeof Intl> {
  const intl = browserGlobals().Intl
  return runProbe(typeof intl === 'object' && intl !== null, () => {
    const value = browserGlobals().Intl
    if (value == null) {
      throw new TypeError('Intl is unavailable')
    }
    void value.DateTimeFormat
    return value
  })
}

/** On-demand `matchMedia` accessor (browser CSS media queries). */
export function getMatchMedia(): ProbeResult<(query: string) => MediaQueryList> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  return runProbe(typeof win.value.matchMedia === 'function', () => win.value.matchMedia.bind(win.value))
}

/**
 * Invokes `matchMedia` for a query and classifies failures.
 * Useful for preference media features without throwing into collectors.
 */
export function probeMatchMedia(query: string): ProbeResult<MediaQueryList> {
  const matchMedia = getMatchMedia()
  if (matchMedia.status !== 'ok') {
    return matchMedia
  }
  try {
    return ok(matchMedia.value(query))
  } catch (error) {
    if (isBlockedBrowserError(error)) {
      return blocked(error instanceof Error ? error.name : 'blocked', error)
    }
    return probeError(error)
  }
}
