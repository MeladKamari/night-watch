import {
  collectLanguages,
  componentsToCanonicalString,
  createBuiltinSources,
  getLanguages,
  getLanguagesValue,
  hashComponents,
  isValueComponent,
  load,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('collectLanguages', () => {
  it('keeps fa-IR / fa / en-US / ar mixed arrays without reordering', () => {
    expect(
      collectLanguages({
        language: 'fa-IR',
        languages: ['fa-IR', 'fa', 'en-US', 'ar'],
      }),
    ).toEqual([['fa-IR'], ['fa-IR', 'fa', 'en-US', 'ar']])
  })

  it('uses legacy IE fields when language is absent', () => {
    expect(collectLanguages({ userLanguage: 'en-US' })).toEqual([['en-US']])
    expect(collectLanguages({ browserLanguage: 'fa' })).toEqual([['fa']])
    expect(collectLanguages({ systemLanguage: 'ar' })).toEqual([['ar']])
  })

  it('splits old string-form languages', () => {
    expect(
      collectLanguages({
        language: 'en',
        languages: 'en,fa-IR,ar',
      }),
    ).toEqual([['en'], ['en', 'fa-IR', 'ar']])
  })

  it('ignores empty string-form languages and non-array non-string values', () => {
    expect(collectLanguages({ language: 'en', languages: '' })).toEqual([['en']])
    expect(
      collectLanguages({
        language: 'en',
        languages: 42 as unknown as string,
      }),
    ).toEqual([['en']])
  })

  it('returns empty list when nothing is available', () => {
    expect(collectLanguages({})).toEqual([])
    expect(collectLanguages(null)).toEqual([])
    expect(collectLanguages(undefined)).toEqual([])
  })

  it('Chromium86+ skip omits languages array (Incognito discrepancy guard)', () => {
    expect(
      collectLanguages(
        {
          language: 'en-US',
          languages: ['en-US'],
        },
        true,
      ),
    ).toEqual([['en-US']])
    expect(
      collectLanguages(
        {
          language: 'en-US',
          languages: ['en-US', 'en'],
        },
        true,
      ),
    ).toEqual([['en-US']])
  })

  it('still pushes empty languages array when not skipped', () => {
    expect(collectLanguages({ language: 'fa', languages: [] })).toEqual([['fa'], []])
  })
})

describe('getLanguagesValue', () => {
  it('does not invent locales under Node', () => {
    expect(getLanguagesValue()).toEqual([])
  })

  it('honors inject + skipLanguagesArray', () => {
    expect(
      getLanguagesValue({
        navigator: { language: 'fa-IR', languages: ['fa-IR', 'en'] },
        skipLanguagesArray: true,
      }),
    ).toEqual([['fa-IR']])
    expect(
      getLanguagesValue({
        navigator: { language: 'fa-IR', languages: ['fa-IR', 'en'] },
      }),
    ).toEqual([['fa-IR'], ['fa-IR', 'en']])
  })
})

describe('builtin languages wiring', () => {
  it('wires languages as source #9; Node yields empty array value', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[8]).toBe('languages')
    expect(sources.languages).toBe(getLanguages)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.languages)).toBe(true)
    if (isValueComponent(result.components.languages)) {
      expect(result.components.languages.value).toEqual([])
    }

    expect(
      componentsToCanonicalString({
        languages: { value: [['fa-IR'], ['fa-IR', 'en']], duration: 1 },
      }),
    ).toContain('languages:')
    expect(
      hashComponents({
        languages: { value: [['en-US']], duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
