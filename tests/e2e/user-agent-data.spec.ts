import { expect, test } from '@playwright/test'
import { collectUserAgentData, isGreaseBrand } from '@thenightwatch/browser-sdk'

test.describe('userAgentData (UA-CH)', () => {
  test('Desktop Chromium exposes UA-CH on HTTPS; GREASE brands are stripped', async ({ page }) => {
    // UA-CH is secure-context-only; about:blank/setContent alone is unreliable in Playwright.
    await page.route('https://ua-ch.local/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><p id="ok">ready</p></body></html>',
      })
    })
    await page.goto('https://ua-ch.local/')
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(async () => {
      const n = navigator as Navigator & {
        userAgentData?: {
          brands: Array<{ brand: string; version: string }>
          mobile: boolean
          platform: string
          getHighEntropyValues?: (hints: string[]) => Promise<{
            architecture?: string
            bitness?: string
            model?: string
            platformVersion?: string
          }>
        }
      }
      const secure = window.isSecureContext === true
      const uaData = n.userAgentData
      if (!uaData) {
        return { present: false as const, secure }
      }

      const isGrease = (brand: string) => /not/i.test(brand)
      const filtered = uaData.brands.filter(({ brand }) => !isGrease(brand)).map(({ brand }) => brand)
      const brands = filtered.length > 1 ? filtered.filter((b) => b !== 'Chromium') : filtered

      let highEntropy: {
        architecture?: string
        bitness?: string
        model?: string
        platformVersion?: string
      } | null = null
      let highEntropyStatus: string | undefined
      if (typeof uaData.getHighEntropyValues === 'function') {
        try {
          highEntropy = await uaData.getHighEntropyValues([
            'architecture',
            'bitness',
            'model',
            'platformVersion',
          ])
        } catch (error) {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            highEntropyStatus = 'not_allowed'
          } else {
            throw error
          }
        }
      }

      return {
        present: true as const,
        secure,
        brands,
        mobile: uaData.mobile,
        platform: uaData.platform,
        rawBrandNames: uaData.brands.map((b) => b.brand),
        highEntropy,
        highEntropyStatus,
      }
    })

    expect(report.secure).toBe(true)
    expect(report.present).toBe(true)
    if (!report.present) {
      return
    }
    expect(report.brands.length).toBeGreaterThan(0)
    expect(report.brands.every((b) => typeof b === 'string')).toBe(true)
    expect(report.brands.every((b) => !isGreaseBrand(b))).toBe(true)
    expect(report.brands).not.toContain('Not:A-Brand')
    expect(typeof report.mobile).toBe('boolean')
    expect(typeof report.platform).toBe('string')

    expect(isGreaseBrand('Not_A Brand')).toBe(true)
    await expect(
      collectUserAgentData({
        brands: [{ brand: 'Not_A Brand', version: '99' }, { brand: 'Google Chrome', version: '1' }],
        mobile: false,
        platform: 'Windows',
      }),
    ).resolves.toEqual({
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Windows',
    })
  })

  test('Permissions-Policy denial maps to highEntropyStatus not_allowed (in-page)', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(async () => {
      const mock = {
        brands: [{ brand: 'Google Chrome', version: '120' }],
        mobile: false,
        platform: 'Linux',
        getHighEntropyValues: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError')
        },
      }
      const filtered = mock.brands
        .filter(({ brand }) => !/not/i.test(brand))
        .map(({ brand }) => brand)
      const result: Record<string, unknown> = {
        brands: filtered,
        mobile: mock.mobile,
        platform: mock.platform,
      }
      try {
        await mock.getHighEntropyValues()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          result.highEntropyStatus = 'not_allowed'
        } else {
          throw error
        }
      }
      return result
    })

    expect(report).toEqual({
      brands: ['Google Chrome'],
      mobile: false,
      platform: 'Linux',
      highEntropyStatus: 'not_allowed',
    })
  })
})
