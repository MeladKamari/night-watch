import { expect, test } from '@playwright/test'

test.describe('indexedDB', () => {
  test('Chromium reports available; never opens a DB; RTL host intact', async ({ page }) => {
    await page.route('https://indexed-db.local/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html dir="rtl"><body><p id="ok">ready</p><p id="fa">\u0633\u0644\u0627\u0645</p></body></html>',
      })
    })
    await page.goto('https://indexed-db.local/')
    await expect(page.locator('#ok')).toHaveText('ready')
    await expect(page.locator('#fa')).toHaveText('سلام')

    const report = await page.evaluate(() => {
      const originalOpen = indexedDB.open.bind(indexedDB)
      let openCalled = false
      indexedDB.open = ((...args: Parameters<IDBFactory['open']>) => {
        openCalled = true
        return originalOpen(...args)
      }) as IDBFactory['open']

      const probe = (): boolean | undefined => {
        // Chromium is not Trident/EdgeHTML — no skip.
        try {
          return !!window.indexedDB
        } catch {
          return true
        }
      }
      const available = probe()
      indexedDB.open = originalOpen

      return {
        available,
        openCalled,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.available).toBe(true)
    expect(report.openCalled).toBe(false)
    expect(report.hostRtl).toBe('rtl')
  })

  test('SecurityError → true; missing → false; legacy IE skip → undefined', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const probe = (
        windowLike: { indexedDB?: IDBFactory | null } | null,
        skipLegacyIE = false,
      ): boolean | undefined => {
        if (skipLegacyIE) {
          return undefined
        }
        if (windowLike == null) {
          return false
        }
        try {
          return !!windowLike.indexedDB
        } catch {
          return true
        }
      }

      const hostile: { indexedDB?: IDBFactory } = {}
      Object.defineProperty(hostile, 'indexedDB', {
        get() {
          throw new DOMException('Blocked', 'SecurityError')
        },
        configurable: true,
      })

      return {
        blocked: probe(hostile),
        missing: probe({}),
        nullFactory: probe({ indexedDB: null }),
        legacySkip: probe({ indexedDB: {} as IDBFactory }, true),
      }
    })
    expect(report.blocked).toBe(true)
    expect(report.missing).toBe(false)
    expect(report.nullFactory).toBe(false)
    expect(report.legacySkip).toBeUndefined()
  })
})
