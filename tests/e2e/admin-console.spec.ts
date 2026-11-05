import { expect, test } from '@playwright/test'

test.describe('admin-console', () => {
  test('offline demo shell loads RTL dashboard nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('night-watch-root')).toBeVisible()
    await expect(page.locator('html, [dir="rtl"]').first()).toBeVisible()
    await page.getByRole('link', { name: 'Events' }).click()
    await expect(page.getByRole('heading', { name: /Event explorer|کاوش رویداد/i })).toBeVisible()
    await page.getByRole('link', { name: 'Keys' }).click()
    await expect(page.getByRole('heading', { name: /API keys|کلیدها/i })).toBeVisible()
    await page.getByRole('link', { name: 'Cases' }).click()
    await expect(page.getByRole('heading', { name: /Fraud cases|پرونده/i })).toBeVisible()
    await page.getByRole('link', { name: 'Rules' }).click()
    await expect(page.getByRole('heading', { name: /Rules|قوانین/i })).toBeVisible()
  })

  test('login route is reachable', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Console login|ورود کنسول/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  })

  test('score and privacy pages load offline', async ({ page }) => {
    await page.goto('/score')
    await expect(page.getByRole('heading', { name: /Suspect Score/i })).toBeVisible()
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /Privacy|حریم خصوصی/i })).toBeVisible()
    await page.goto('/deploy')
    await expect(page.getByRole('heading', { name: /Enterprise first-party deployment/i })).toBeVisible()
    await expect(page.getByText(/ONPREM\.md/i).first()).toBeVisible()
  })
})
