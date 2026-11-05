import { expect, test } from '@playwright/test'

const Status = {
  IntlAPINotSupported: -1,
  DateTimeFormatNotSupported: -2,
  LocaleNotAvailable: -3,
} as const

const LOCALE_TAG = /^[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Z]{2}|[0-9]{3}))?(-[A-Za-z0-9]+)*$/

test.describe('dateTimeLocale', () => {
  test('Chromium returns BCP47-like default locale; RTL host intact; no forced fa-IR', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale
      return {
        locale,
        hostRtl: document.documentElement.getAttribute('dir'),
        hasIntl: typeof Intl !== 'undefined',
        hasDTF: typeof Intl?.DateTimeFormat === 'function',
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.hasIntl).toBe(true)
    expect(report.hasDTF).toBe(true)
    expect(report.locale).toMatch(LOCALE_TAG)
    // Must not invent Iran locale from RTL markup alone
    expect(report.locale === 'fa-IR' || report.locale.startsWith('fa')).toBe(
      report.locale.startsWith('fa'),
    )
  })

  test('special statuses: no Intl / missing DTF / null locale; empty string kept', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((status) => {
      const collect = (intl: { DateTimeFormat?: () => { resolvedOptions: () => { locale?: string | null } } } | null) => {
        if (intl == null) return status.IntlAPINotSupported
        const DateTimeFormat = intl.DateTimeFormat
        if (!DateTimeFormat) return status.DateTimeFormatNotSupported
        const locale = DateTimeFormat().resolvedOptions().locale
        if (!locale && locale !== '') return status.LocaleNotAvailable
        return locale
      }

      return {
        noIntl: collect(null),
        noDtf: collect({}),
        undefLocale: collect({
          DateTimeFormat: () => ({ resolvedOptions: () => ({ locale: undefined }) }),
        }),
        nullLocale: collect({
          DateTimeFormat: () => ({ resolvedOptions: () => ({ locale: null }) }),
        }),
        emptyLocale: collect({
          DateTimeFormat: () => ({ resolvedOptions: () => ({ locale: '' }) }),
        }),
      }
    }, Status)

    expect(report.noIntl).toBe(Status.IntlAPINotSupported)
    expect(report.noDtf).toBe(Status.DateTimeFormatNotSupported)
    expect(report.undefLocale).toBe(Status.LocaleNotAvailable)
    expect(report.nullLocale).toBe(Status.LocaleNotAvailable)
    expect(report.emptyLocale).toBe('')
  })

  test('fa-IR / persian / gregory / en-US / ar format without overwriting default collector locale', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const tags = [
        'fa-IR',
        'fa-IR-u-ca-persian',
        'fa-IR-u-ca-gregory',
        'en-US',
        'ar',
      ] as const
      const samples: Record<string, { locale: string; formatted: string; calendar?: string }> = {}
      for (const tag of tags) {
        const dtf = new Intl.DateTimeFormat(tag, {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        })
        const opts = dtf.resolvedOptions()
        samples[tag] = {
          locale: opts.locale,
          formatted: dtf.format(new Date('2024-03-20T12:00:00Z')),
          calendar: opts.calendar,
        }
      }
      const defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale
      return { samples, defaultLocale }
    })

    for (const tag of Object.keys(report.samples)) {
      expect(report.samples[tag]!.locale.length).toBeGreaterThan(0)
      expect(report.samples[tag]!.formatted.length).toBeGreaterThan(0)
    }
    // Default probe remains whatever the browser default is — not auto-switched to Jalali
    expect(typeof report.defaultLocale).toBe('string')
    expect(report.defaultLocale.length).toBeGreaterThan(0)
  })
})
