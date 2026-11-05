import { expect, test } from '@playwright/test'

test('playground fixture exposes Persian RTL surrounding and English LTR diagnostics', async ({
  page,
}) => {
  await page.goto('/')

  const surrounding = page.locator('#surrounding')
  await expect(surrounding).toHaveAttribute('dir', 'rtl')
  await expect(surrounding).toHaveAttribute('lang', 'fa')
  await expect(surrounding).toContainText('اثرانگشت')

  const diagnostics = page.locator('#diagnostics')
  await expect(diagnostics).toHaveAttribute('dir', 'ltr')
  await expect(diagnostics).toHaveAttribute('lang', 'en')
  await expect(diagnostics).toContainText('Developer diagnostics')
  await expect(page.locator('#diag-manifest')).toHaveText('default-v1')
  await expect(page.locator('#diag-sources')).toContainText('41')

  const remoteOrigins = await page.evaluate(() => {
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
  expect(remoteOrigins).toEqual([])
})
