import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const iifePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../packages/browser-sdk/dist/fp.min.js',
)

test('self-hosted IIFE script tag works offline under CSP-friendly page', async ({ page }) => {
  const iife = readFileSync(iifePath, 'utf8')

  const requests: string[] = []
  page.on('request', (req) => {
    requests.push(req.url())
  })

  // CSP allows only 'self' scripts — we inject the bundle as a same-document classic script
  // (self-hosted asset, no CDN). No remote hosts.
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';" />
        <!-- Bundle must run without 'unsafe-eval' (CSP-friendly). -->
      </head>
      <body>
        <pre id="out">pending</pre>
        <script>${iife.replace(/<\/script/gi, '<\\/script')}</script>
        <script>
          (async function () {
            try {
              if (!window.NightWatch || typeof NightWatch.load !== 'function') {
                throw new Error('NightWatch global missing')
              }
              if (NightWatch.ENABLED_SOURCE_COUNT !== 41) {
                throw new Error('expected 41 sources')
              }
              if (NightWatch.ENABLED_SOURCES.indexOf('applePay') !== -1) {
                throw new Error('applePay must be absent')
              }
              var agent = await NightWatch.load({ delayFallback: 0, monitoring: false })
              var result = await agent.get()
              document.getElementById('out').textContent = JSON.stringify({
                visitorId: result.visitorId,
                version: result.version,
                keys: Object.keys(result.components).length,
              })
            } catch (err) {
              document.getElementById('out').textContent = 'ERR:' + (err && err.message ? err.message : String(err))
            }
          })()
        </script>
      </body>
    </html>`,
    { waitUntil: 'domcontentloaded' },
  )

  await expect(page.locator('#out')).not.toHaveText('pending', { timeout: 30_000 })
  const text = (await page.locator('#out').textContent()) ?? ''
  expect(text.startsWith('ERR:')).toBe(false)
  const payload = JSON.parse(text) as { visitorId: string; version: string; keys: number }
  expect(payload.visitorId).toMatch(/^[0-9a-f]{32}$/)
  expect(payload.keys).toBe(41)

  // No outbound network: only about:blank / data document requests if any.
  const remote = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith('http://127.0.0.1'))
  expect(remote).toEqual([])
})
