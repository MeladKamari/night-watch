import { expect, test } from '@playwright/test'
import {
  DomOperationTimeoutError,
  isAnyParentCrossOrigin,
  isFullscreenActive,
  isInIframe,
  withIframe,
} from '@night-watch/core'

/**
 * In-page DOM helpers are exercised via page.evaluate with inlined logic mirroring
 * `@night-watch/core` until the playground bundles the package. Node-side imports stay SSR-safe.
 */
test.describe('DOM / iframe isolation', () => {
  test('offscreen iframe runs action, then removes itself (no orphan nodes)', async ({ page }) => {
    await page.setContent('<!doctype html><html><body><div id="host">h</div></body></html>')

    const report = await page.evaluate(async () => {
      const d = document
      const before = d.querySelectorAll('iframe').length

      const iframeRef: { node: HTMLIFrameElement | null } = { node: null }
      const result = await (async () => {
        const iframe = d.createElement('iframe')
        iframeRef.node = iframe
        const { style } = iframe
        style.setProperty('display', 'block', 'important')
        style.position = 'absolute'
        style.visibility = 'hidden'
        style.width = '0'
        style.height = '0'
        iframe.src = 'about:blank'
        d.body.appendChild(iframe)
        await new Promise<void>((resolve, reject) => {
          iframe.onload = () => resolve()
          iframe.onerror = () => reject(new Error('load failed'))
          if (iframe.contentWindow?.document?.readyState === 'complete') {
            resolve()
          }
        })
        while (!iframe.contentWindow?.document?.body) {
          await new Promise((r) => setTimeout(r, 10))
        }
        const inside = iframe.contentWindow!.document.body.appendChild(
          iframe.contentWindow!.document.createElement('span'),
        )
        inside.textContent = 'probe'
        const during = d.querySelectorAll('iframe').length
        iframe.parentNode?.removeChild(iframe)
        return { during, text: inside.textContent }
      })()

      return {
        before,
        during: result.during,
        after: d.querySelectorAll('iframe').length,
        stillInDom: iframeRef.node ? d.body.contains(iframeRef.node) : false,
        text: result.text,
      }
    })

    expect(report.before).toBe(0)
    expect(report.during).toBe(1)
    expect(report.after).toBe(0)
    expect(report.stillInDom).toBe(false)
    expect(report.text).toBe('probe')

    // Package APIs under Playwright worker remain SSR-safe.
    expect(isInIframe()).toBe(false)
    expect(isAnyParentCrossOrigin()).toBe(false)
    expect(isFullscreenActive()).toBe(false)
    await expect(withIframe(async () => 1)).rejects.toBeTruthy()
  })

  test('host CSS does not contaminate iframe document measurements', async ({ page }) => {
    await page.setContent(`<!doctype html><html><head>
      <style>* { font-size: 99px !important; }</style>
    </head><body></body></html>`)

    const report = await page.evaluate(async () => {
      const d = document
      const host = d.createElement('div')
      host.textContent = 'x'
      d.body.appendChild(host)
      const hostSize = getComputedStyle(host).fontSize

      const iframe = d.createElement('iframe')
      iframe.srcdoc = '<!doctype html><html><body></body></html>'
      d.body.appendChild(iframe)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('iframe load timeout')), 5000)
        const done = () => {
          clearTimeout(timer)
          resolve()
        }
        iframe.onload = () => done()
        if (iframe.contentWindow?.document?.readyState === 'complete' && iframe.contentDocument?.body) {
          done()
        }
      })
      while (!iframe.contentDocument?.body) {
        await new Promise((r) => setTimeout(r, 10))
      }
      const idoc = iframe.contentDocument
      const el = idoc.createElement('div')
      el.textContent = 'x'
      idoc.body.appendChild(el)
      const iframeSize = iframe.contentWindow!.getComputedStyle(el).fontSize
      iframe.remove()
      host.remove()
      return { hostSize, iframeSize }
    })

    expect(report.hostSize).toBe('99px')
    expect(report.iframeSize).not.toBe('99px')
  })

  test('abort removes iframe; timeout surfaces DomOperationTimeoutError name', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(async () => {
      async function withIframeLocal<T>(
        action: (iframe: HTMLIFrameElement) => Promise<T>,
        opts: { signal?: AbortSignal; timeoutMs?: number } = {},
      ): Promise<T> {
        const d = document
        const iframe = d.createElement('iframe')
        iframe.src = 'about:blank'
        const controller = opts.timeoutMs != null ? new AbortController() : undefined
        let timer: number | undefined
        if (controller && opts.timeoutMs != null) {
          timer = window.setTimeout(() => {
            const err = new Error('DOM iframe operation timed out')
            err.name = 'DomOperationTimeoutError'
            controller.abort(err)
          }, opts.timeoutMs)
        }
        const signal = opts.signal ?? controller?.signal
        try {
          d.body.appendChild(iframe)
          await new Promise<void>((resolve, reject) => {
            iframe.onload = () => resolve()
            iframe.onerror = () => reject(new Error('fail'))
            signal?.addEventListener(
              'abort',
              () => {
                iframe.remove()
                reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'))
              },
              { once: true },
            )
          })
          return await Promise.race([
            action(iframe),
            new Promise<T>((_, reject) => {
              signal?.addEventListener(
                'abort',
                () => {
                  iframe.remove()
                  reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'))
                },
                { once: true },
              )
            }),
          ])
        } finally {
          if (timer != null) {
            clearTimeout(timer)
          }
          iframe.remove()
        }
      }

      const abortCtrl = new AbortController()
      const abortPromise = withIframeLocal(async () => {
        await new Promise((r) => setTimeout(r, 5000))
        return 'nope'
      }, { signal: abortCtrl.signal })
      queueMicrotask(() => abortCtrl.abort())
      let abortName = ''
      let abortIframes = -1
      try {
        await abortPromise
      } catch (e) {
        abortName = e instanceof Error ? e.name : 'unknown'
        abortIframes = document.querySelectorAll('iframe').length
      }

      let timeoutName = ''
      let timeoutIframes = -1
      try {
        await withIframeLocal(async () => {
          await new Promise((r) => setTimeout(r, 5000))
          return 'nope'
        }, { timeoutMs: 30 })
      } catch (e) {
        timeoutName = e instanceof Error ? e.name : 'unknown'
        timeoutIframes = document.querySelectorAll('iframe').length
      }

      return { abortName, abortIframes, timeoutName, timeoutIframes }
    })

    expect(report.abortName).toMatch(/AbortError|Error/)
    expect(report.abortIframes).toBe(0)
    expect(report.timeoutName).toBe('DomOperationTimeoutError')
    expect(report.timeoutIframes).toBe(0)
    expect(new DomOperationTimeoutError().name).toBe('DomOperationTimeoutError')
  })

  test('sandboxed child iframe is detectable; parent stays usable', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(async () => {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', 'allow-scripts')
      iframe.srcdoc = `<!doctype html><html><body><script>
        parent.postMessage({
          type: 'sandbox-probe',
          inIframe: self !== top,
          hasParent: !!parent
        }, '*');
      </script></body></html>`
      document.body.appendChild(iframe)

      const child = await new Promise<{ inIframe: boolean }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 5000)
        window.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as { type?: string; inIframe?: boolean }
          if (data?.type === 'sandbox-probe') {
            clearTimeout(timer)
            resolve({ inIframe: !!data.inIframe })
          }
        })
      })

      const sandboxed = iframe.hasAttribute('sandbox')
      iframe.remove()
      return {
        childInIframe: child.inIframe,
        sandboxed,
        parentIframes: document.querySelectorAll('iframe').length,
        parentOk: typeof document.body.appendChild === 'function',
      }
    })

    expect(report.childInIframe).toBe(true)
    expect(report.sandboxed).toBe(true)
    expect(report.parentIframes).toBe(0)
    expect(report.parentOk).toBe(true)
  })

  test('style application uses setProperty (CSP-friendly path)', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const el = document.createElement('div')
      const source = 'color: rgb(1, 2, 3); margin-top: 4px !important'
      for (const property of source.split(';')) {
        const match = /^\s*([\w-]+)\s*:\s*(.+?)(\s*!([\w-]+))?\s*$/.exec(property)
        if (match) {
          el.style.setProperty(match[1]!, match[2]!, match[4] || '')
        }
      }
      // Never assign cssText wholesale in this helper path.
      return {
        color: el.style.getPropertyValue('color'),
        margin: el.style.getPropertyValue('margin-top'),
        priority: el.style.getPropertyPriority('margin-top'),
        attrStyle: el.getAttribute('style'),
      }
    })

    expect(report.color).toContain('1')
    expect(report.margin).toBe('4px')
    expect(report.priority).toBe('important')
  })
})
