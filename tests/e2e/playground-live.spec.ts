import { expect, test } from '@playwright/test'

test.describe('live playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('RTL surrounding + LTR diagnostics shell, no remote asset tags', async ({ page }) => {
    const surrounding = page.locator('#surrounding')
    await expect(surrounding).toHaveAttribute('dir', 'rtl')
    await expect(surrounding).toHaveAttribute('lang', 'fa')
    await expect(surrounding).toContainText('اثرانگشت')

    const diagnostics = page.locator('#diagnostics')
    await expect(diagnostics).toHaveAttribute('dir', 'ltr')
    await expect(diagnostics).toHaveAttribute('lang', 'en')
    await expect(page.locator('#diag-manifest')).toHaveText('default-v1')
    await expect(page.locator('#playground-app')).toBeVisible()

    const remoteAssets = await page.evaluate(() => {
      const urls: string[] = []
      for (const el of document.querySelectorAll('link[href], script[src], img[src]')) {
        const href =
          (el as HTMLLinkElement).href ||
          (el as HTMLScriptElement).src ||
          (el as HTMLImageElement).src
        if (!href) {
          continue
        }
        const url = new URL(href, location.href)
        if (url.origin !== location.origin) {
          urls.push(href)
        }
      }
      return urls
    })
    expect(remoteAssets).toEqual([])
  })

  test('collect requires consent; shows visitorId table; copy is user-triggered; no upload', async ({
    page,
    browserName,
  }) => {
    const collect = page.locator('#collect')
    const copy = page.locator('#copy-json')
    await expect(collect).toBeDisabled()
    await expect(copy).toBeDisabled()

    const requests: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('http://localhost:4173')) {
        requests.push(url)
      }
    })

    await page.locator('#consent').check()
    await expect(collect).toBeEnabled()

    await collect.click()
    await expect(page.locator('#status')).toContainText(/Collection complete|repeat run/i, {
      timeout: 30_000,
    })

    const visitorId = (await page.locator('#visitor-id').textContent())?.trim() ?? ''
    expect(visitorId).toMatch(/^[0-9a-f]{32}$/)

    await expect(page.locator('#signals-body tr')).toHaveCount(41, { timeout: 5_000 })
    await expect(page.locator('#sdk-version')).not.toHaveText('—')
    await expect(page.locator('#confidence-score')).not.toHaveText('—')

    // Readable error / unsupported list is present (may be empty of errors on Chromium).
    await expect(page.locator('#unsupported-list')).toBeVisible()

    await expect(copy).toBeEnabled()
    // clipboard-* permissions are Chromium-oriented in Playwright; Firefox/WebKit reject grantPermissions.
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    }
    await copy.click()
    await expect(page.locator('#status')).toContainText(/Copied JSON/i)
    if (browserName === 'chromium') {
      const clip = await page.evaluate(async () => navigator.clipboard.readText())
      expect(clip).toContain(visitorId)
      expect(clip).toContain('"components"')
      expect(clip).not.toContain('applePay')
    }

    expect(requests).toEqual([])
  })

  test('keyboard access: Tab reaches consent and activate collect with Enter', async ({ page }) => {
    await page.locator('#consent').focus()
    await page.keyboard.press('Space')
    await expect(page.locator('#consent')).toBeChecked()
    await expect(page.locator('#collect')).toBeEnabled()

    await page.locator('#collect').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#status')).toContainText(/Collection complete|repeat run|Collecting/i, {
      timeout: 30_000,
    })
    await expect(page.locator('#visitor-id')).toHaveText(/^[0-9a-f]{32}$/, { timeout: 30_000 })
  })

  test('independent repeat run fills comparison panel', async ({ page }) => {
    await page.locator('#consent').check()
    await page.locator('#collect').click()
    await expect(page.locator('#visitor-id')).toHaveText(/^[0-9a-f]{32}$/, { timeout: 30_000 })

    await page.locator('#collect').click()
    await expect(page.locator('#compare-panel')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('#compare-body')).toContainText('Previous visitorId')
    await expect(page.locator('#compare-body')).toContainText('Current visitorId')
  })
})
