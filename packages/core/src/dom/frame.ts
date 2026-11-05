import { getFullscreenElement } from '../browser/engines.js'
import { getBrowserContext, type BrowserContext } from '../browser/context.js'
import { isBrowserEnvironment } from '../runtime/environment.js'

/**
 * True when this realm is nested in an iframe (or frame) relative to its parent.
 * Safe under Node (false). Does not navigate or touch parent documents beyond reads.
 */
export function isInIframe(context?: BrowserContext): boolean {
  const c = context ?? getBrowserContext()
  if (!c) {
    return false
  }
  try {
    return c.window.self !== c.window.top
  } catch {
    // Accessing top can throw when cross-origin; that still means we are framed.
    return true
  }
}

/**
 * True when any ancestor window is cross-origin relative to the current window.
 * Observable behavior aligned with FingerprintJS OSS v5.3.0 `isAnyParentCrossOrigin`.
 */
export function isAnyParentCrossOrigin(context?: BrowserContext): boolean {
  const c = context ?? getBrowserContext()
  if (!c) {
    return false
  }

  let currentWindow: Window = c.window
  for (;;) {
    let parentWindow: Window
    try {
      parentWindow = currentWindow.parent
    } catch {
      return true
    }
    if (!parentWindow || parentWindow === currentWindow) {
      return false
    }

    try {
      if (parentWindow.location.origin !== currentWindow.location.origin) {
        return true
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'SecurityError') {
        return true
      }
      throw error
    }

    currentWindow = parentWindow
  }
}

/**
 * Returns `window.frameElement` when readable (same-origin embedder).
 * `null` when top-level, unavailable, or blocked — never throws for cross-origin.
 */
export function getFrameElement(context?: BrowserContext): Element | null {
  const c = context ?? getBrowserContext()
  if (!c) {
    return null
  }
  try {
    return c.window.frameElement
  } catch {
    return null
  }
}

/**
 * Best-effort sandbox detection for the current frame.
 * - Reads `sandbox` on `frameElement` when same-origin embedder is readable.
 * - Falls back to missing `window.parent` access patterns only when framed.
 * Returns `unsupported` semantics as `null` when not in a browser / not framed /
 * frameElement unreadable (do not invent true).
 */
export function isCurrentFrameSandboxed(context?: BrowserContext): boolean | null {
  if (!isBrowserEnvironment() && !context) {
    return null
  }
  const c = context ?? getBrowserContext()
  if (!c) {
    return null
  }
  if (!isInIframe(c)) {
    return false
  }

  const frame = getFrameElement(c)
  if (!frame) {
    return null
  }
  if (!('sandbox' in frame)) {
    return null
  }
  const sandbox = (frame as HTMLIFrameElement).sandbox
  // DOMTokenList: length > 0 means sandbox attribute present with tokens;
  // empty sandbox attribute still sandboxes everything — treat attribute presence.
  if (typeof sandbox === 'object' && sandbox !== null && 'length' in sandbox) {
    const hasAttr = frame.hasAttribute('sandbox')
    return hasAttr
  }
  return frame.hasAttribute('sandbox')
}

/** True when any element is currently fullscreen in this document. */
export function isFullscreenActive(context?: BrowserContext): boolean {
  return getFullscreenElement(context) != null
}
