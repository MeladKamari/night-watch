import { expect, test } from '@playwright/test'
import { ENABLED_SOURCE_COUNT, SOURCE_MANIFEST_REVISION } from '@thenightwatch/core'

/**
 * Cross-browser smoke: validates Playwright wiring and that Node can still
 * import the built registry while a browser context exists.
 */
test('browser smoke and registry constants remain available', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html><body><h1 id="t">night-watch-ok</h1></body></html>',
  )
  await expect(page.locator('#t')).toHaveText('night-watch-ok')
  expect(SOURCE_MANIFEST_REVISION).toBe('default-v1')
  expect(ENABLED_SOURCE_COUNT).toBe(41)
})
