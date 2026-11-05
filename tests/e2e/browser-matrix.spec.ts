import { expect, test } from '@playwright/test'
import {
  escapeInlineScript,
  injectSdkAndCollect,
  readSdkIife,
} from './helpers/inject-sdk.js'

/**
 * Cross-browser integration matrix (step 57).
 * Runs on Chromium, Firefox, WebKit (+ chromium-incognito project).
 * Real-device / cloud browsers are documented as NOT RUN in docs/BROWSER_COVERAGE.md.
 */

test.describe('browser coverage matrix', () => {
  test('collects 41 sources with visitorId; applePay absent; no egress', async ({
    page,
    browserName,
  }, testInfo) => {
    const remote: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (/^https?:/i.test(url)) {
        remote.push(url)
      }
    })

    await page.setContent(
      '<!doctype html><html lang="en"><body><main id="host">matrix</main></body></html>',
    )

    const summary = await injectSdkAndCollect(page)
    expect(summary.sourceCount).toBe(41)
    expect(summary.enabledSourceCount).toBe(41)
    expect(summary.hasApplePay).toBe(false)
    expect(summary.visitorId).toMatch(/^[0-9a-f]{32}$/)

    // Headless caveats: collection must still complete (chrome object / GPU may differ).
    testInfo.annotations.push({
      type: 'headless-caveat',
      description: `${browserName}: headless may omit window.chrome or use software GL; visitorId still produced`,
    })

    expect(remote).toEqual([])
  })

  test('CSP without unsafe-eval still runs self-hosted IIFE collect', async ({ page }) => {
    const iife = escapeInlineScript(readSdkIife())
    await page.setContent(
      `<!doctype html>
      <html>
        <head>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline';" />
        </head>
        <body>
          <pre id="out">pending</pre>
          <script>${iife}</script>
          <script>
            (async function () {
              try {
                var agent = await NightWatch.load({ delayFallback: 0, monitoring: false })
                var result = await agent.get()
                document.getElementById('out').textContent = JSON.stringify({
                  visitorId: result.visitorId,
                  keys: Object.keys(result.components).length,
                  applePay: Object.keys(result.components).indexOf('applePay') !== -1,
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
    const payload = JSON.parse(text) as { visitorId: string; keys: number; applePay: boolean }
    expect(payload.visitorId).toMatch(/^[0-9a-f]{32}$/)
    expect(payload.keys).toBe(41)
    expect(payload.applePay).toBe(false)
  })

  test('iframe sandbox without allow-same-origin blocks storage APIs', async ({ page }) => {
    // Use the loopback playground origin — about:blank is opaque and blocks storage on the parent too.
    await page.goto('/')

    const report = await page.evaluate(async () => {
      return await new Promise<{
        parentSession: boolean | string
        childSession: boolean | string
        childOrigin: string
      }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sandbox timeout')), 8000)
        window.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as {
            type?: string
            session?: boolean | string
            origin?: string
          }
          if (data?.type !== 'sandbox-storage') {
            return
          }
          clearTimeout(timer)
          let parentSession: boolean | string = false
          try {
            parentSession = !!window.sessionStorage
            window.sessionStorage.setItem('night-watch', '1')
            window.sessionStorage.removeItem('night-watch')
            parentSession = true
          } catch (error) {
            parentSession = error instanceof Error ? error.name : 'error'
          }
          resolve({
            parentSession,
            childSession: data.session ?? 'missing',
            childOrigin: String(data.origin ?? ''),
          })
        })

        const iframe = document.createElement('iframe')
        iframe.setAttribute('sandbox', 'allow-scripts')
        iframe.srcdoc = `<!doctype html><script>
          var session = false;
          try {
            session = !!window.sessionStorage;
            window.sessionStorage.setItem('x','1');
            session = true;
          } catch (e) {
            session = e && e.name ? e.name : 'error';
          }
          parent.postMessage({ type: 'sandbox-storage', session: session, origin: String(location.origin) }, '*');
        </script>`
        document.body.appendChild(iframe)
      })
    })

    expect(report.parentSession).toBe(true)
    // Sandboxed child without allow-same-origin typically throws SecurityError on storage.
    expect(report.childSession === true).toBe(false)
  })

  test('storage-blocked parent still yields deterministic collect shape', async ({ page }) => {
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addInitScript(() => {
      const boom = () => {
        throw new DOMException('Blocked', 'SecurityError')
      }
      Object.defineProperty(window, 'sessionStorage', { get: boom })
      Object.defineProperty(window, 'localStorage', { get: boom })
    })

    const summary = await injectSdkAndCollect(page)
    expect(summary.sourceCount).toBe(41)
    expect(summary.visitorId).toMatch(/^[0-9a-f]{32}$/)
    // Storage sources should not crash the agent; values are typically true (caught) or error arms.
    expect(['value', 'error']).toContain(summary.sessionStorage.kind)
    expect(['value', 'error']).toContain(summary.localStorage.kind)
  })

  test('WebGL disabled (Chromium launch args) keeps collect healthy', async ({
    browserName,
    playwright,
  }) => {
    test.skip(browserName !== 'chromium', 'WebGL disable flags are Chromium-oriented')

    const browser = await playwright.chromium.launch({
      args: ['--disable-webgl', '--disable-3d-apis'],
    })
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.setContent('<!doctype html><html><body></body></html>')
      const summary = await injectSdkAndCollect(page)
      expect(summary.sourceCount).toBe(41)
      expect(summary.visitorId).toMatch(/^[0-9a-f]{32}$/)
      // Disabled GL → value with status -1 or an error arm; never throws out of get().
      expect(['value', 'error']).toContain(summary.webGlBasics.kind)
      await context.close()
    } finally {
      await browser.close()
    }
  })

  test('audio API denied still completes collection', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'OfflineAudioContext', {
        configurable: true,
        get() {
          throw new DOMException('Audio denied', 'NotAllowedError')
        },
      })
      Object.defineProperty(window, 'webkitOfflineAudioContext', {
        configurable: true,
        get() {
          return undefined
        },
      })
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        get() {
          throw new DOMException('Audio denied', 'NotAllowedError')
        },
      })
    })
    await page.setContent('<!doctype html><html><body></body></html>')
    const summary = await injectSdkAndCollect(page)
    expect(summary.sourceCount).toBe(41)
    expect(summary.visitorId).toMatch(/^[0-9a-f]{32}$/)
    expect(['value', 'error']).toContain(summary.audio.kind)
  })

  test('independent incognito-like contexts do not share storage state', async ({
    browser,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://127.0.0.1:4173'
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    try {
      const pageA = await contextA.newPage()
      const pageB = await contextB.newPage()
      await pageA.goto(origin)
      await pageB.goto(origin)

      await pageA.evaluate(() => {
        window.localStorage.setItem('night-watch-matrix', 'from-A')
      })
      const leaked = await pageB.evaluate(() => window.localStorage.getItem('night-watch-matrix'))
      expect(leaked).toBeNull()

      const summaryA = await injectSdkAndCollect(pageA)
      const summaryB = await injectSdkAndCollect(pageB)
      expect(summaryA.sourceCount).toBe(41)
      expect(summaryB.sourceCount).toBe(41)
      expect(summaryA.hasApplePay).toBe(false)
      expect(summaryB.hasApplePay).toBe(false)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})

test.describe('Iran locale / timezone fixtures (not nationality assumptions)', () => {
  test.use({
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })

  test('fa-IR + Asia/Tehran context still yields 41-source collect', async ({ page }) => {
    await page.setContent(
      '<!doctype html><html lang="fa" dir="rtl"><body><p>سلام</p></body></html>',
    )
    const summary = await injectSdkAndCollect(page)
    expect(summary.sourceCount).toBe(41)
    expect(summary.visitorId).toMatch(/^[0-9a-f]{32}$/)
    expect(summary.hasApplePay).toBe(false)
    // Locale/timezone are measured when APIs allow — never forced as identity.
    expect(['value', 'error']).toContain(summary.timezone.kind)
    expect(['value', 'error']).toContain(summary.languages.kind)
  })
})
