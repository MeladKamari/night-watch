import { expect, test } from '@playwright/test'

test.describe('cookiesEnabled', () => {
  test('Chromium first-party cookie probe writes then clears cookietest; RTL intact', async ({
    page,
  }) => {
    // about:blank / setContent denies document.cookie; use a real HTTPS origin.
    await page.route('https://cookies-enabled.local/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html dir="rtl"><body><p id="ok">ready</p><p id="fa">\u0633\u0644\u0627\u0645</p></body></html>',
      })
    })
    await page.goto('https://cookies-enabled.local/')
    await expect(page.locator('#ok')).toHaveText('ready')
    await expect(page.locator('#fa')).toHaveText('سلام')

    const report = await page.evaluate(() => {
      const name = 'cookietest'
      const before = document.cookie
      let result = false
      try {
        document.cookie = `${name}=1; SameSite=Strict;`
        result = document.cookie.indexOf(`${name}=`) !== -1
      } catch {
        result = false
      } finally {
        try {
          document.cookie = `${name}=1; SameSite=Strict; expires=Thu, 01-Jan-1970 00:00:01 GMT`
        } catch {
          /* ignore */
        }
      }
      const after = document.cookie
      return {
        result,
        beforeHadTest: before.includes(`${name}=`),
        afterHasTest: after.includes(`${name}=`),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.result).toBe(true)
    expect(report.afterHasTest).toBe(false)
  })

  test('SecurityError / blocked cookie access maps to false with cleanup attempt', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const writes: string[] = []
      const probe = (doc: { cookie: string }) => {
        let result = false
        try {
          doc.cookie = 'cookietest=1; SameSite=Strict;'
          result = doc.cookie.indexOf('cookietest=') !== -1
        } catch {
          result = false
        } finally {
          try {
            doc.cookie = 'cookietest=1; SameSite=Strict; expires=Thu, 01-Jan-1970 00:00:01 GMT'
          } catch {
            /* ignore */
          }
        }
        return result
      }

      const hostile = {
        get cookie() {
          throw new Error('SecurityError')
        },
        set cookie(v: string) {
          writes.push(v)
          throw new Error('SecurityError')
        },
      }

      const blocked = {
        get cookie() {
          return ''
        },
        set cookie(v: string) {
          writes.push(v)
        },
      }

      return {
        securityError: probe(hostile),
        blockedWrite: probe(blocked),
        wroteClear: writes.some((w) => /expires=/i.test(w)),
      }
    })

    expect(report.securityError).toBe(false)
    expect(report.blockedWrite).toBe(false)
    expect(report.wroteClear).toBe(true)
  })

  test('sandboxed iframe without allow-same-origin: cookie probe → false', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(async () => {
      const iframe = document.createElement('iframe')
      iframe.sandbox.add('allow-scripts')
      // no allow-same-origin
      const html =
        '<!doctype html><script>parent.postMessage({cookieEnabled: (()=>{try{document.cookie="cookietest=1; SameSite=Strict;";const r=document.cookie.indexOf("cookietest=")!==-1;document.cookie="cookietest=1; SameSite=Strict; expires=Thu, 01-Jan-1970 00:00:01 GMT";return r}catch(e){try{document.cookie="cookietest=1; SameSite=Strict; expires=Thu, 01-Jan-1970 00:00:01 GMT"}catch(_){}return false}})()},"*")</script>'
      iframe.srcdoc = html
      document.body.appendChild(iframe)

      const result = await new Promise<boolean>((resolve) => {
        const onMsg = (ev: MessageEvent) => {
          if (ev.data && typeof ev.data.cookieEnabled === 'boolean') {
            window.removeEventListener('message', onMsg)
            resolve(ev.data.cookieEnabled)
          }
        }
        window.addEventListener('message', onMsg)
        setTimeout(() => {
          window.removeEventListener('message', onMsg)
          resolve(false)
        }, 2000)
      })

      iframe.remove()
      return { sandboxed: result }
    })

    expect(report.sandboxed).toBe(false)
  })
})
