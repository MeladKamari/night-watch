import {
  getDocument,
  getNavigator,
  getWindow,
  toInt,
  type BuiltinSourceOptions,
  type Source,
} from '@night-watch/core'

/**
 * Observable touch-capability signals.
 * This is a crude probe — it does **not** prove a physical touchscreen is present.
 *
 * @see http://www.stucox.com/blog/you-cant-detect-a-touchscreen/
 */
export type TouchSupport = {
  maxTouchPoints: number
  /** Whether `document.createEvent('TouchEvent')` succeeds. */
  touchEvent: boolean
  /** Whether the `ontouchstart` property exists on `window`. */
  touchStart: boolean
}

/** Navigator surface used for max touch points (incl. legacy IE `msMaxTouchPoints`). */
export type NavigatorWithTouch = {
  readonly maxTouchPoints?: number
  readonly msMaxTouchPoints?: number
}

/** Document surface for TouchEvent creation probe. */
export type DocumentWithCreateEvent = {
  createEvent?: (eventInterface: string) => Event
}

export type TouchSupportOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithTouch | null
  /** Inject document-like object for tests (skips live `getDocument`). */
  document?: DocumentWithCreateEvent | null
  /** Inject window-like object for tests (skips live `getWindow`). */
  window?: object | null
}

/**
 * Collects maxTouchPoints, TouchEvent creation support, and ontouchstart presence.
 * Does not subscribe to touch events or claim physical touchscreen certainty.
 */
export function getTouchSupportValue(options: TouchSupportOptions = {}): TouchSupport {
  return {
    maxTouchPoints: readMaxTouchPoints(options),
    touchEvent: probeTouchEvent(options),
    touchStart: probeTouchStart(options),
  }
}

export function readMaxTouchPoints(options: TouchSupportOptions = {}): number {
  const nav = resolveNavigator(options)
  if (!nav) {
    return 0
  }
  if (nav.maxTouchPoints !== undefined) {
    return toInt(nav.maxTouchPoints)
  }
  if (nav.msMaxTouchPoints !== undefined) {
    return nav.msMaxTouchPoints
  }
  return 0
}

export function probeTouchEvent(options: TouchSupportOptions = {}): boolean {
  const doc = resolveDocument(options)
  if (!doc || typeof doc.createEvent !== 'function') {
    return false
  }
  try {
    doc.createEvent('TouchEvent')
    return true
  } catch {
    return false
  }
}

export function probeTouchStart(options: TouchSupportOptions = {}): boolean {
  const win = resolveWindow(options)
  if (!win) {
    return false
  }
  return 'ontouchstart' in win
}

function resolveNavigator(options: TouchSupportOptions): NavigatorWithTouch | null | undefined {
  if ('navigator' in options) {
    return options.navigator
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return navProbe.value as NavigatorWithTouch
}

function resolveDocument(
  options: TouchSupportOptions,
): DocumentWithCreateEvent | null | undefined {
  if ('document' in options) {
    return options.document
  }
  const docProbe = getDocument()
  if (docProbe.status !== 'ok') {
    return undefined
  }
  return docProbe.value as DocumentWithCreateEvent
}

function resolveWindow(options: TouchSupportOptions): object | null | undefined {
  if ('window' in options) {
    return options.window
  }
  const winProbe = getWindow()
  if (winProbe.status !== 'ok') {
    return undefined
  }
  return winProbe.value
}

/** Entropy source: crude touch input capability signals. */
export const getTouchSupport: Source<BuiltinSourceOptions, TouchSupport> = () =>
  getTouchSupportValue()
