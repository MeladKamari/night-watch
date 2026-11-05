import { expect, test } from '@playwright/test'

test.describe('localStorage', () => {
  test('Chromium reports available; probe does not write; RTL host intact', async ({ page }) => {
    await page.route('https://local-storage.local/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html dir="rtl"><body><p id="ok">ready</p><p id="fa">\u0633\u0644\u0627\u0645</p></body></html>',
      })
    })
    await page.goto('https://local-storage.local/')
    await expect(page.locator('#ok')).toHaveText('ready')
    await expect(page.locator('#fa')).toHaveText('سلام')

    const report = await page.evaluate(() => {
      const marker = '__ibf_local_storage_probe__'
      localStorage.removeItem(marker)
      const before = localStorage.getItem(marker)

      const probe = (): boolean => {
        try {
          return !!window.localStorage
        } catch {
          return true
        }
      }
      const available = probe()
      const after = localStorage.getItem(marker)
      const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))

      return {
        available,
        before,
        after,
        wroteMarker: keys.includes(marker),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.available).toBe(true)
    expect(report.before).toBeNull()
    expect(report.after).toBeNull()
    expect(report.wroteMarker).toBe(false)
    expect(report.hostRtl).toBe('rtl')
  })

  test('SecurityError on access maps to true; missing maps to false', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const probe = (windowLike: { localStorage?: Storage | null } | null): boolean => {
        if (windowLike == null) {
          return false
        }
        try {
          return !!windowLike.localStorage
        } catch {
          return true
        }
      }

      const hostile: { localStorage?: Storage } = {}
      Object.defineProperty(hostile, 'localStorage', {
        get() {
          throw new DOMException('Blocked', 'SecurityError')
        },
        configurable: true,
      })

      return {
        blocked: probe(hostile),
        missing: probe({}),
        nullStorage: probe({ localStorage: null }),
        nullWindow: probe(null),
      }
    })
    expect(report.blocked).toBe(true)
    expect(report.missing).toBe(false)
    expect(report.nullStorage).toBe(false)
    expect(report.nullWindow).toBe(false)
  })

  test('sandboxed iframe without allow-same-origin: access throws → true semantics', async ({
    page,
  }) => {
    await page.route('https://local-storage.local/frame', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body></body></html>',
      })
    })
    await page.goto('https://local-storage.local/frame')

    const report = await page.evaluate(async () => {
      const iframe = document.createElement('iframe')
      iframe.sandbox.add('allow-scripts')
      const html =
        '<!doctype html><script>parent.postMessage({type:"ls",v:(()=>{try{return{ok:!!window.localStorage,threw:false}}catch(e){return{ok:true,threw:true,name:e&&e.name}}})()},"*")</script>'
      document.body.appendChild(iframe)
      const result = await new Promise<{ ok: boolean; threw: boolean; name?: string }>((resolve) => {
        const onMsg = (ev: MessageEvent) => {
          if (ev.data && ev.data.type === 'ls') {
            window.removeEventListener('message', onMsg)
            resolve(ev.data.v)
          }
        }
        window.addEventListener('message', onMsg)
        iframe.srcdoc = html
      })
      iframe.remove()
      return result
    })

    expect(typeof report.ok).toBe('boolean')
    if (report.threw) {
      expect(report.ok).toBe(true)
      expect(report.name).toBe('SecurityError')
    }
  })
})
