import { getDocument, getNavigator, getSecureContext } from '@thenightwatch/core'
import type { DiagnosticEnvironment } from './types.js'

/**
 * Collects redacted environment hints for diagnostics.
 * Never reads `location`, `document.title`, cookies, or storage contents.
 * SSR-safe: returns minimal block when browser globals are unavailable.
 */
export function collectRedactedEnvironment(): DiagnosticEnvironment {
  const env: {
    userAgent?: string
    language?: string
    languages?: string[]
    platform?: string
    secureContext?: boolean
    documentDir?: string
    pageContextRedacted: true
  } = {
    pageContextRedacted: true,
  }

  const nav = getNavigator()
  if (nav.status === 'ok') {
    const navigator = nav.value
    if (typeof navigator.userAgent === 'string') {
      env.userAgent = navigator.userAgent
    }
    if (typeof navigator.language === 'string') {
      env.language = navigator.language
    }
    if (Array.isArray(navigator.languages)) {
      env.languages = [...navigator.languages].map(String)
    }
    if (typeof navigator.platform === 'string') {
      env.platform = navigator.platform
    }
  }

  const secure = getSecureContext()
  if (secure.status === 'ok') {
    env.secureContext = secure.value
  }

  const doc = getDocument()
  if (doc.status === 'ok') {
    const dir = doc.value.documentElement?.getAttribute('dir')
    if (dir) {
      env.documentDir = dir
    }
  }

  return env
}
