import { expect, test } from '@playwright/test'

test.describe('admin-console live API', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { NIGHT_WATCH_NETWORK: number }).NIGHT_WATCH_NETWORK = 1
      ;(window as unknown as { NIGHT_WATCH_API_BASE: string }).NIGHT_WATCH_API_BASE = 'http://127.0.0.1:5080/'
      ;(window as unknown as { NIGHT_WATCH_TENANT_ID: string }).NIGHT_WATCH_TENANT_ID = 'tenant_demo'
    })
  })

  test('login then create key with CSRF', async ({ page }) => {
    const createdStatuses: number[] = []
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && /\/v1\/management\/keys\/?$/.test(res.url())) {
        createdStatuses.push(res.status())
      }
    })

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Console login|ورود کنسول/i })).toBeVisible()
    await page.getByLabel(/Username/i).fill('admin')
    await page.getByLabel(/Password/i).fill('admin-change-me')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible()

    await page.getByRole('link', { name: 'Keys' }).click()
    await expect(page.getByRole('heading', { name: /API keys|کلیدها/i })).toBeVisible()
    await page.getByRole('button', { name: /Create public key/i }).click()
    await expect.poll(() => createdStatuses.includes(201), { timeout: 20_000 }).toBeTruthy()
  })

  test('login then score explain + signals', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/Username/i).fill('admin')
    await page.getByLabel(/Password/i).fill('admin-change-me')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL(/dashboard/)

    await page.getByRole('link', { name: 'Score' }).click()
    await expect(page.getByRole('heading', { name: /Suspect Score/i })).toBeVisible()
    await page.getByRole('button', { name: /Explain sample/i }).click()
    await expect(page.locator('code').filter({ hasText: 'api' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/humanity/i)).toBeVisible()

    await page.getByRole('link', { name: 'Signals' }).click()
    await page.getByRole('button', { name: /Evaluate sample/i }).click()
    await expect(page.getByText(/browser_bot_detection/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
