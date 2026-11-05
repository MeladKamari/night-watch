import { expect, test } from '@playwright/test'
import {
  FONT_PREFERENCES_DEFAULT_TEXT,
  FONT_PREFERENCE_PRESETS,
  UnsupportedEnvironmentError,
  getFontPreferences,
  normalizeFontMeasurement,
} from '@night-watch/browser-sdk'

test.describe('fontPreferences', () => {
  test('Node getFontPreferences does not invent widths', async () => {
    await expect(getFontPreferences({ cache: {} })).rejects.toBeInstanceOf(
      UnsupportedEnvironmentError,
    )
  })

  test('iframe natural-font probe returns preset widths; cleans up; RTL host layout intact', async ({
    page,
  }) => {
    await page.setContent(`<!doctype html><html dir="rtl"><head>
      <style>body { font-family: "Comic Sans MS"; font-size: 22px; }</style>
    </head><body><p id="host">میزبان</p></body></html>`)
    await expect(page.locator('#host')).toHaveText('میزبان')
    const beforeBox = await page.locator('#host').boundingBox()

    const report = await page.evaluate(
      async ({ defaultText, presetKeys, iframeHtml }) => {
        async function measureOnce(): Promise<Record<string, number>> {
          const iframe = document.createElement('iframe')
          iframe.srcdoc = iframeHtml
          Object.assign(iframe.style, {
            display: 'block',
            position: 'absolute',
            visibility: 'hidden',
            width: '0',
            height: '0',
            border: '0',
          })
          document.body.appendChild(iframe)
          try {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('iframe timeout')), 5000)
              const done = () => {
                clearTimeout(timer)
                resolve()
              }
              iframe.onload = () => done()
              if (iframe.contentDocument?.readyState === 'complete' && iframe.contentDocument.body) {
                done()
              }
            })
            while (!iframe.contentDocument?.body) {
              await new Promise((r) => setTimeout(r, 10))
            }
            const win = iframe.contentWindow!
            const doc = iframe.contentDocument
            const body = doc.body
            body.style.width = '4000px'
            ;(body.style as CSSStyleDeclaration & { textSizeAdjust?: string }).textSizeAdjust =
              'none'
            body.style.zoom = `${1 / win.devicePixelRatio}`

            const filler = doc.createElement('div')
            filler.textContent = Array.from({ length: 200 }, () => 'word').join(' ')
            body.appendChild(filler)

            const styles: Record<string, Partial<CSSStyleDeclaration>> = {
              default: {},
              apple: { font: '-apple-system-body' } as Partial<CSSStyleDeclaration>,
              serif: { fontFamily: 'serif' },
              sans: { fontFamily: 'sans-serif' },
              mono: { fontFamily: 'monospace' },
              min: { fontSize: '1px' },
              system: { fontFamily: 'system-ui' },
            }
            const els: Record<string, HTMLElement> = {}
            for (const key of presetKeys) {
              const el = doc.createElement('span')
              el.textContent = defaultText
              el.style.whiteSpace = 'nowrap'
              Object.assign(el.style, styles[key])
              els[key] = el
              body.append(doc.createElement('br'), el)
            }
            const out: Record<string, number> = {}
            for (const key of presetKeys) {
              const raw = els[key]!.getBoundingClientRect().width
              out[key] = Math.floor(raw * win.devicePixelRatio * 1000) / 1000
            }
            return out
          } finally {
            iframe.remove()
          }
        }

        const first = await measureOnce()
        const second = await measureOnce()
        return {
          first,
          second,
          iframes: document.querySelectorAll('iframe').length,
          dir: document.documentElement.getAttribute('dir'),
          hostFont: getComputedStyle(document.getElementById('host')!).fontFamily,
        }
      },
      {
        defaultText: FONT_PREFERENCES_DEFAULT_TEXT,
        presetKeys: Object.keys(FONT_PREFERENCE_PRESETS),
        iframeHtml:
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
      },
    )

    expect(report.iframes).toBe(0)
    expect(report.dir).toBe('rtl')
    expect(report.hostFont.toLowerCase()).toMatch(/comic/i)
    expect(report.second).toEqual(report.first)
    for (const key of Object.keys(FONT_PREFERENCE_PRESETS)) {
      expect(typeof report.first[key]).toBe('number')
      expect(Number.isFinite(report.first[key]!)).toBe(true)
    }
    expect(report.first.min!).toBeLessThanOrEqual(report.first.default!)

    const afterBox = await page.locator('#host').boundingBox()
    expect(afterBox?.y).toBe(beforeBox?.y)
    expect(normalizeFontMeasurement(12.3456, false)).toBe(12.345)
  })

  test('blocked iframe creation leaves no orphans', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const original = document.createElement.bind(document)
      document.createElement = ((tag: string) => {
        if (tag === 'iframe') {
          throw new DOMException('Blocked', 'SecurityError')
        }
        return original(tag)
      }) as typeof document.createElement
      let name = ''
      try {
        document.createElement('iframe')
      } catch (e) {
        name = e instanceof Error ? e.name : 'unknown'
      }
      document.createElement = original
      return { name, iframes: document.querySelectorAll('iframe').length }
    })
    expect(report.name).toBe('SecurityError')
    expect(report.iframes).toBe(0)
  })
})
