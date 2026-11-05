export type UiLocale = 'fa-IR' | 'en-US'

export type LocaleLayout = {
  locale: UiLocale
  dir: 'rtl' | 'ltr'
  timeZone: 'Asia/Tehran'
}

export function layoutForLocale(locale: UiLocale): LocaleLayout {
  return {
    locale,
    dir: locale === 'fa-IR' ? 'rtl' : 'ltr',
    timeZone: 'Asia/Tehran',
  }
}

/** ISO instant in → display string in Asia/Tehran (Intl; no foreign SaaS). */
export function formatTehran(iso: string, locale: UiLocale): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'invalid_time'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Tehran',
  }).format(d)
}
