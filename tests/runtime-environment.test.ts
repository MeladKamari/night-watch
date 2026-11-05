import {
  UnsupportedEnvironmentError,
  assertBrowserEnvironment,
  blocked,
  getAudioContextConstructor,
  getDocument,
  getIntl,
  getMatchMedia,
  getNavigator,
  getOfflineAudioContextConstructor,
  getScreen,
  getSecureContext,
  getWindow,
  isBlockedBrowserError,
  isBrowserEnvironment,
  ok,
  probeError,
  probeWebGlContext,
  runProbe,
  unsupported,
} from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('runtime environment guards (Node / SSR)', () => {
  it('imports and reports non-browser environment without throwing', () => {
    expect(isBrowserEnvironment()).toBe(false)
    expect(getWindow()).toEqual({ status: 'unsupported' })
    expect(getDocument()).toEqual({ status: 'unsupported' })
    expect(getNavigator()).toEqual({ status: 'unsupported' })
    expect(getScreen()).toEqual({ status: 'unsupported' })
    expect(getMatchMedia()).toEqual({ status: 'unsupported' })
    expect(getSecureContext()).toEqual({ status: 'unsupported' })
    expect(getAudioContextConstructor()).toEqual({ status: 'unsupported' })
    expect(getOfflineAudioContextConstructor()).toEqual({ status: 'unsupported' })
    expect(probeWebGlContext()).toEqual({ status: 'unsupported' })
  })

  it('assertBrowserEnvironment throws a meaningful unsupported error on Node', () => {
    expect(() => assertBrowserEnvironment()).toThrow(UnsupportedEnvironmentError)
    expect(() => assertBrowserEnvironment()).toThrow(/Browser environment is required/)
  })

  it('exposes Intl on Node as ok (not a browser global dependency)', () => {
    const intl = getIntl()
    expect(intl.status).toBe('ok')
    if (intl.status === 'ok') {
      expect(typeof intl.value.DateTimeFormat).toBe('function')
      // Locale is a test input only — no Iran hardcoding in runtime helpers.
      const formatted = new intl.value.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
      }).format(Date.UTC(2026, 0, 1))
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    }
  })

  it('classifies SecurityError / NotAllowedError as blocked', () => {
    const security = new Error('denied')
    security.name = 'SecurityError'
    const notAllowed = new Error('nope')
    notAllowed.name = 'NotAllowedError'
    expect(isBlockedBrowserError(security)).toBe(true)
    expect(isBlockedBrowserError(notAllowed)).toBe(true)
    expect(isBlockedBrowserError(new Error('other'))).toBe(false)
    expect(isBlockedBrowserError('x')).toBe(false)
  })

  it('runProbe maps presence, blocked, and unexpected errors', () => {
    expect(runProbe(false, () => 1)).toEqual({ status: 'unsupported' })
    expect(runProbe(true, () => 2)).toEqual({ status: 'ok', value: 2 })

    const security = new Error('sandbox')
    security.name = 'SecurityError'
    expect(runProbe(true, () => {
      throw security
    })).toMatchObject({ status: 'blocked', reason: 'SecurityError' })

    expect(runProbe(true, () => {
      throw new Error('boom')
    })).toMatchObject({ status: 'error' })
  })

  it('probe helpers construct discriminated results', () => {
    expect(ok(1)).toEqual({ status: 'ok', value: 1 })
    expect(unsupported()).toEqual({ status: 'unsupported' })
    expect(blocked('SecurityError')).toEqual({ status: 'blocked', reason: 'SecurityError' })
    expect(probeError('x')).toEqual({ status: 'error', error: 'x' })
  })
})
