import {
  DateTimeLocaleStatus,
  collectDateTimeLocale,
  componentsToCanonicalString,
  createBuiltinSources,
  getDateTimeLocale,
  getDateTimeLocaleValue,
  hashComponents,
  isValueComponent,
  load,
  type DateTimeFormatLike,
  type IntlWithDateTimeFormat,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

/** Loose BCP 47 tag check (upstream-style). */
const LOCALE_TAG = /^[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Z]{2}|[0-9]{3}))?(-[A-Za-z0-9]+)*$/

function mockIntl(locale: string | null | undefined): IntlWithDateTimeFormat {
  const DateTimeFormat = (() => ({
    resolvedOptions: () => ({ locale }),
  })) as DateTimeFormatLike
  return { DateTimeFormat }
}

describe('collectDateTimeLocale / getDateTimeLocaleValue', () => {
  it('returns default locale string under Node Intl', () => {
    const value = getDateTimeLocaleValue()
    expect(typeof value).toBe('string')
    expect(value).toMatch(LOCALE_TAG)
  })

  it('No Intl → IntlAPINotSupported (-1)', () => {
    expect(collectDateTimeLocale(null)).toBe(DateTimeLocaleStatus.IntlAPINotSupported)
    expect(collectDateTimeLocale(undefined)).toBe(DateTimeLocaleStatus.IntlAPINotSupported)
    expect(getDateTimeLocaleValue({ intl: null })).toBe(DateTimeLocaleStatus.IntlAPINotSupported)
  })

  it('missing DateTimeFormat → DateTimeFormatNotSupported (-2)', () => {
    expect(collectDateTimeLocale({})).toBe(DateTimeLocaleStatus.DateTimeFormatNotSupported)
    expect(getDateTimeLocaleValue({ intl: {} })).toBe(
      DateTimeLocaleStatus.DateTimeFormatNotSupported,
    )
  })

  it('null/undefined locale → LocaleNotAvailable (-3); empty string kept', () => {
    expect(collectDateTimeLocale(mockIntl(undefined))).toBe(
      DateTimeLocaleStatus.LocaleNotAvailable,
    )
    expect(collectDateTimeLocale(mockIntl(null))).toBe(DateTimeLocaleStatus.LocaleNotAvailable)
    expect(collectDateTimeLocale(mockIntl(''))).toBe('')
  })

  it('does not invent or force a locale; inject passes through', () => {
    expect(collectDateTimeLocale(mockIntl('en-US'))).toBe('en-US')
    expect(collectDateTimeLocale(mockIntl('fa-IR'))).toBe('fa-IR')
    expect(collectDateTimeLocale(mockIntl('zh-Hans-CN'))).toBe('zh-Hans-CN')
  })
})

describe('Iran / RTL locale compatibility (Intl inputs; no forced default)', () => {
  it('DateTimeFormat accepts fa-IR / persian calendar / gregory / en-US / ar without collector override', () => {
    const cases = [
      'fa-IR',
      'fa-IR-u-ca-persian',
      'fa-IR-u-ca-gregory',
      'en-US',
      'ar',
    ] as const

    for (const tag of cases) {
      const dtf = new Intl.DateTimeFormat(tag)
      const resolved = dtf.resolvedOptions()
      expect(typeof resolved.locale).toBe('string')
      expect(resolved.locale.length).toBeGreaterThan(0)
      // Numerals / calendar may vary by engine; ensure format returns a non-empty string
      const formatted = dtf.format(new Date('2024-03-20T12:00:00Z'))
      expect(formatted.length).toBeGreaterThan(0)
    }

    // Default locale path must not switch to Jalali automatically
    const defaultLocale = getDateTimeLocaleValue()
    expect(typeof defaultLocale === 'string' || typeof defaultLocale === 'number').toBe(true)
    // Collector returns default resolved locale only — not a forced fa-IR
    expect(getDateTimeLocaleValue()).toBe(Intl.DateTimeFormat().resolvedOptions().locale)
  })

  it('persian vs gregory calendars differ in format output where engine supports both', () => {
    const persian = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const gregory = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const instant = new Date('2024-03-20T12:00:00Z')
    const p = persian.format(instant)
    const g = gregory.format(instant)
    expect(p.length).toBeGreaterThan(0)
    expect(g.length).toBeGreaterThan(0)
    // Engines that honor calendar unicode extensions should diverge
    if (
      persian.resolvedOptions().calendar === 'persian' &&
      gregory.resolvedOptions().calendar === 'gregory'
    ) {
      expect(p).not.toBe(g)
    }
  })
})

describe('builtin dateTimeLocale wiring', () => {
  it('wires dateTimeLocale as source #39; Node yields a locale string', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[38]).toBe('dateTimeLocale')
    expect(sources.dateTimeLocale).toBe(getDateTimeLocale)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.dateTimeLocale)).toBe(true)
    if (isValueComponent(result.components.dateTimeLocale)) {
      expect(typeof result.components.dateTimeLocale.value).toBe('string')
    }

    expect(
      componentsToCanonicalString({
        dateTimeLocale: { value: 'fa-IR', duration: 1 },
      }),
    ).toContain('dateTimeLocale:')
    expect(
      hashComponents({
        dateTimeLocale: { value: DateTimeLocaleStatus.IntlAPINotSupported, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
    expect(
      hashComponents({ dateTimeLocale: { value: 'en-US', duration: 1 } }),
    ).not.toBe(hashComponents({ dateTimeLocale: { value: 'fa-IR', duration: 1 } }))
  })
})
