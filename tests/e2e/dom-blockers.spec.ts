import { expect, test } from '@playwright/test'
import {
  collectDomBlockers,
  getFilters,
  isDomBlockersApplicable,
} from '@thenightwatch/browser-sdk'

test.describe('domBlockers', () => {
  test('Desktop Chromium is not eligible → undefined (no fabricated blockers)', async () => {
    // Playwright worker is Node; page is Chromium (not WebKit/Android).
    expect(isDomBlockersApplicable()).toBe(false)
    expect(await collectDomBlockers()).toBeUndefined()
  })

  test('in-page probe cleans up DOM, ignores host CSS, makes no network requests', async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (req) => {
      requests.push(req.url())
    })

    await page.setContent(`<!doctype html><html><head>
      <style>#adblock-honeypot { display: none !important; }</style>
    </head><body><p id="ok">ready</p></body></html>`)
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(async () => {
      const selectors = ['#adblock-honeypot', '.adblocker-root', '#probe-ok']
      const d = document
      const root = d.createElement('div')
      root.style.setProperty('visibility', 'hidden', 'important')
      root.style.setProperty('display', 'block', 'important')
      const elements: HTMLElement[] = []
      for (const selector of selectors) {
        const el = d.createElement(selector.startsWith('#') ? 'div' : 'div')
        if (selector.startsWith('#')) {
          el.id = selector.slice(1)
        } else if (selector.startsWith('.')) {
          el.className = selector.slice(1)
        }
        const holder = d.createElement('div')
        holder.style.setProperty('display', 'block', 'important')
        holder.appendChild(el)
        root.appendChild(holder)
        elements.push(el)
      }
      d.body.appendChild(root)
      const before = d.body.contains(root)
      const blocked: Record<string, true> = {}
      for (let i = 0; i < selectors.length; i++) {
        if (!elements[i]!.offsetParent) {
          blocked[selectors[i]!] = true
        }
      }
      root.remove()
      return {
        before,
        after: d.body.contains(root),
        orphanRoots: d.querySelectorAll('body > div').length,
        blocked,
        fetchInPage: typeof fetch === 'function',
      }
    })

    expect(report.before).toBe(true)
    expect(report.after).toBe(false)
    // Host CSS may zero offsetParent for #adblock-honeypot — that is environmental, not a network call.
    expect(requests.filter((u) => !u.startsWith('data:') && !u.includes('about:'))).toEqual([])
    expect(getFilters().adBlockWarningRemoval).toContain('#adblock-honeypot')
  })

  test('filter list stays local (includes Persian list name from upstream dataset)', () => {
    const filters = getFilters()
    expect(filters).toHaveProperty('adBlockPersian')
    expect(Object.keys(filters).sort().slice(0, 3)).toEqual(['abpIndo', 'abpvn', 'adBlockFinland'])
  })
})
