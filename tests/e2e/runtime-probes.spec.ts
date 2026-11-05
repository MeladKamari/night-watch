import { expect, test } from '@playwright/test'
import {
  assertBrowserEnvironment,
  getDocument,
  getMatchMedia,
  getNavigator,
  getScreen,
  getWindow,
  isBrowserEnvironment,
  probeMatchMedia,
  probeWebGlContext,
  releaseWebGlProbe,
} from '@night-watch/core'

test.describe('browser runtime probes', () => {
  test('window/document/navigator/screen are ok in Chromium', async ({ page }) => {
    await page.setContent('<!doctype html><html><body><p id="x">ready</p></body></html>')
    await expect(page.locator('#x')).toHaveText('ready')

    const report = await page.evaluate(() => {
      const g = globalThis as typeof globalThis & {
        window: Window
        document: Document
        navigator: Navigator
        screen: Screen
      }
      const hasWindow = typeof g.window === 'object' && g.window !== null
      const hasDocument = typeof g.document === 'object' && g.document !== null
      const hasNavigator = typeof g.navigator === 'object' && g.navigator !== null
      const hasScreen = typeof g.screen === 'object' && g.screen !== null
      const matchMediaOk = typeof g.window.matchMedia === 'function'
      let mediaMatches = false
      if (matchMediaOk) {
        mediaMatches = g.window.matchMedia('(min-width: 0px)').matches
      }
      let webgl = false
      const canvas = g.document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl') ||
        canvas.getContext('webgl2')
      webgl = !!gl
      return { hasWindow, hasDocument, hasNavigator, hasScreen, matchMediaOk, mediaMatches, webgl }
    })

    expect(report.hasWindow).toBe(true)
    expect(report.hasDocument).toBe(true)
    expect(report.hasNavigator).toBe(true)
    expect(report.hasScreen).toBe(true)
    expect(report.matchMediaOk).toBe(true)
    expect(report.mediaMatches).toBe(true)

    // Playwright worker is Node: package probes must stay SSR-safe here.
    expect(isBrowserEnvironment()).toBe(false)
    expect(getWindow().status).toBe('unsupported')
    expect(() => assertBrowserEnvironment()).toThrow()
  })

  test('sandboxed iframe child can probe; parent page remains usable', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const child = await page.evaluate(async () => {
      const g = globalThis as typeof globalThis & { window: Window; document: Document }

      return await new Promise<{ hasMatchMedia: boolean; uniqueOrigin: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('child probe timeout')), 5000)

        g.window.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as {
            type?: string
            hasMatchMedia?: boolean
            uniqueOrigin?: string
          }
          if (data && data.type === 'child-probe') {
            clearTimeout(timer)
            resolve({
              hasMatchMedia: !!data.hasMatchMedia,
              uniqueOrigin: String(data.uniqueOrigin),
            })
          }
        })

        const iframe = g.document.createElement('iframe')
        iframe.setAttribute('sandbox', 'allow-scripts')
        iframe.srcdoc = `<!doctype html><html><body><script>
          parent.postMessage({
            type: 'child-probe',
            hasMatchMedia: typeof matchMedia === 'function',
            uniqueOrigin: String(location.origin)
          }, '*');
        </script></body></html>`
        g.document.body.appendChild(iframe)
      })
    })

    // Sandboxed without allow-same-origin => opaque unique origin
    expect(child.uniqueOrigin === 'null' || child.uniqueOrigin.includes('null')).toBe(true)
    expect(child.hasMatchMedia).toBe(true)

    const parent = await page.evaluate(() => {
      const w = (globalThis as typeof globalThis & { window: Window }).window
      return {
        matchMedia: typeof w.matchMedia === 'function',
        prefersReducedMotion: w.matchMedia('(prefers-reduced-motion: reduce)').media,
      }
    })
    expect(parent.matchMedia).toBe(true)
    expect(parent.prefersReducedMotion).toContain('prefers-reduced-motion')

    expect(getDocument().status).toBe('unsupported')
    expect(getNavigator().status).toBe('unsupported')
    expect(getScreen().status).toBe('unsupported')
    expect(getMatchMedia().status).toBe('unsupported')
    expect(probeMatchMedia('(min-width: 0px)').status).toBe('unsupported')
    expect(probeWebGlContext().status).toBe('unsupported')
    expect(typeof releaseWebGlProbe).toBe('function')
  })
})
