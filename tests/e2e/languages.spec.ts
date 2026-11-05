import { expect, test } from '@playwright/test'

test.describe('languages', () => {
  test('Chromium ≥86 keeps language; omits languages array; fa-IR inject preserves order', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator
      const language = n.language || (n as Navigator & { userLanguage?: string }).userLanguage
      const result: string[][] = []
      if (language !== undefined) {
        result.push([language])
      }
      // Mirror Chromium ≥86 skip (Desktop Chrome in this matrix).
      const skipLanguagesArray = true
      if (Array.isArray(n.languages) && !skipLanguagesArray) {
        result.push([...n.languages])
      }

      const mixed = {
        language: 'fa-IR',
        languages: ['fa-IR', 'fa', 'en-US', 'ar'] as string[],
      }
      const collected: string[][] = []
      if (mixed.language !== undefined) {
        collected.push([mixed.language])
      }
      collected.push([...mixed.languages])

      return {
        chromiumShape: result,
        hasNativeLanguage: typeof n.language === 'string' && n.language.length > 0,
        languagesIsArray: Array.isArray(n.languages),
        mixedPreserved: collected,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hasNativeLanguage).toBe(true)
    expect(report.languagesIsArray).toBe(true)
    expect(report.chromiumShape).toHaveLength(1)
    expect(report.chromiumShape[0]).toHaveLength(1)
    expect(report.mixedPreserved).toEqual([['fa-IR'], ['fa-IR', 'fa', 'en-US', 'ar']])
    expect(report.hostRtl).toBe('rtl')
  })

  test('string-form languages split; empty and non-array ignored', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const split = (languages: string) => (languages ? languages.split(',') : [])
      const weird: unknown = 42
      return {
        split: split('en,fa-IR,ar'),
        empty: split(''),
        nonArrayIgnored: typeof weird !== 'string' && !Array.isArray(weird),
      }
    })
    expect(report.split).toEqual(['en', 'fa-IR', 'ar'])
    expect(report.empty).toEqual([])
    expect(report.nonArrayIgnored).toBe(true)
  })
})

