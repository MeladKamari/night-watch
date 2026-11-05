import { getDocument, getNavigator, getScreen, getWindow } from '../runtime/globals.js'
import { isBrowserEnvironment } from '../runtime/environment.js'

/**
 * Snapshot of browser globals for detectors.
 * Obtained on demand — never at module import.
 */
export type BrowserContext = {
  window: Window
  navigator: Navigator
  document: Document
  screen: Screen
}

/**
 * Resolves a usable browser context, or `undefined` under Node / incomplete realms.
 */
export function getBrowserContext(): BrowserContext | undefined {
  if (!isBrowserEnvironment()) {
    return undefined
  }

  const win = getWindow()
  const nav = getNavigator()
  const doc = getDocument()
  const scr = getScreen()

  if (win.status !== 'ok' || nav.status !== 'ok' || doc.status !== 'ok' || scr.status !== 'ok') {
    return undefined
  }

  return {
    window: win.value,
    navigator: nav.value,
    document: doc.value,
    screen: scr.value,
  }
}
