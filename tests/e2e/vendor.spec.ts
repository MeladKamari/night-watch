import { expect, test } from '@playwright/test'

test.describe('vendor', () => {
  test('Chromium returns vendor string or empty; empty/undefined → ""; no UA invent', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const read = (nav: { vendor?: string } | null | undefined) => {
        if (nav == null) {
          return ''
        }
        return nav.vendor || ''
      }

      const native = navigator.vendor || ''

      Object.defineProperty(navigator, 'vendor', {
        configurable: true,
        get() {
          return 'Apple Computer, Inc.'
        },
      })
      const safariSpoof = (navigator as Navigator).vendor || ''

      Object.defineProperty(navigator, 'vendor', {
        configurable: true,
        get() {
          return ''
        },
      })
      const empty = (navigator as Navigator).vendor || ''

      Object.defineProperty(navigator, 'vendor', {
        configurable: true,
        get() {
          return undefined as unknown as string
        },
      })
      const undef = (navigator as Navigator).vendor || ''

      return {
        native,
        safariSpoof,
        empty,
        undef,
        missingNav: read(null),
        ua: navigator.userAgent,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(typeof report.native).toBe('string')
    // Desktop Chromium typically "Google Inc."; accept any string including empty.
    expect(report.safariSpoof).toBe('Apple Computer, Inc.')
    expect(report.empty).toBe('')
    expect(report.undef).toBe('')
    expect(report.missingNav).toBe('')
    expect(report.ua.length).toBeGreaterThan(0)
    expect(report.hostRtl).toBe('rtl')
  })

  test('property access errors surface (do not coerce to empty success)', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const hostile = {} as { vendor?: string }
      Object.defineProperty(hostile, 'vendor', {
        configurable: true,
        get() {
          throw new Error('vendor privacy')
        },
      })

      let threw = false
      let message = ''
      try {
        void (hostile.vendor || '')
      } catch (e) {
        threw = true
        message = e instanceof Error ? e.message : String(e)
      }
      return { threw, message }
    })

    expect(report.threw).toBe(true)
    expect(report.message).toBe('vendor privacy')
  })
})
