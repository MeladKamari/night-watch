import { describe, expect, it } from 'vitest'
import { assertCsrfHeader, canActivateRoute } from './rbac.js'
import { formatTehran, layoutForLocale } from './i18n-time.js'

describe('admin console RBAC and i18n', () => {
  it('enforces role routes and CSRF', () => {
    expect(canActivateRoute('/dashboard', ['viewer'])).toBe(true)
    expect(canActivateRoute('/keys', ['viewer'])).toBe(false)
    expect(canActivateRoute('/keys', ['admin'])).toBe(true)
    expect(canActivateRoute('/signals', ['analyst'])).toBe(true)
    expect(canActivateRoute('/deploy', ['admin'])).toBe(false)
    expect(canActivateRoute('/deploy', ['owner'])).toBe(true)
    expect(canActivateRoute('/docs/api', ['viewer'])).toBe(true)
    expect(assertCsrfHeader({ 'x-csrf-token': '1234567890abcdef' })).toBe(true)
    expect(assertCsrfHeader({})).toBe(false)
  })

  it('fa-IR RTL and Tehran formatting', () => {
    expect(layoutForLocale('fa-IR')).toEqual({ locale: 'fa-IR', dir: 'rtl', timeZone: 'Asia/Tehran' })
    expect(layoutForLocale('en-US').dir).toBe('ltr')
    const text = formatTehran('2026-11-03T20:30:00.000Z', 'en-US')
    expect(text).not.toBe('invalid_time')
    expect(text.length).toBeGreaterThan(5)
  })
})
