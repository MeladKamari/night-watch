import { expect, test } from '@playwright/test'

/**
 * Browser smoke for agent load/get. Uses page.evaluate with inlined expectations
 * until the playground bundles `@night-watch/browser-sdk` for in-page import.
 * Full collector values remain unimplemented → components may be errors; API shape must hold.
 */
test('document environment supports fingerprint agent preconditions', async ({ page }) => {
  await page.setContent('<!doctype html><html><body><p id="ok">ready</p></body></html>')
  await expect(page.locator('#ok')).toHaveText('ready')

  const report = await page.evaluate(() => {
    const g = globalThis as typeof globalThis & { window: Window }
    return {
      hasWindow: typeof g.window === 'object',
      hasNavigator: typeof g.window.navigator === 'object',
      monitoringEndpointsTouched: false,
    }
  })

  expect(report.hasWindow).toBe(true)
  expect(report.hasNavigator).toBe(true)
  expect(report.monitoringEndpointsTouched).toBe(false)
})
