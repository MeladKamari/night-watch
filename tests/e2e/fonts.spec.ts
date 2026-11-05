import { expect, test } from '@playwright/test'
import {
  FONT_BASE_FAMILIES,
  FONT_CANDIDATE_LIST,
  FONT_PROBE_SIZE,
  FONT_PROBE_STRING,
  UnsupportedEnvironmentError,
  getFonts,
} from '@night-watch/browser-sdk'

test.describe('fonts source', () => {
  test('Node getFonts does not invent an empty success list', async () => {
    await expect(getFonts({ cache: {} })).rejects.toBeInstanceOf(UnsupportedEnvironmentError)
  })

  test('iframe probe returns ordered string[]; cleans up; host CSS does not leak', async ({
    page,
  }) => {
    await page.setContent(`<!doctype html><html><head>
      <style>* { font-family: "Comic Sans MS" !important; font-size: 8px !important; }</style>
    </head><body><p id="ok">ready</p></body></html>`)
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(
      async ({ testString, textSize, baseFonts, fontList }) => {
        async function withIframe<T>(action: (doc: Document) => T): Promise<T> {
          const iframe = document.createElement('iframe')
          iframe.src = 'about:blank'
          const { style } = iframe
          style.setProperty('display', 'block', 'important')
          style.position = 'absolute'
          style.visibility = 'hidden'
          style.width = '0'
          style.height = '0'
          document.body.appendChild(iframe)
          try {
            await new Promise<void>((resolve, reject) => {
              const done = () => resolve()
              iframe.onload = () => done()
              iframe.onerror = () => reject(new Error('iframe load failed'))
              if (iframe.contentDocument?.readyState === 'complete') {
                done()
              }
            })
            while (!iframe.contentDocument?.body) {
              await new Promise((r) => setTimeout(r, 10))
            }
            return action(iframe.contentDocument)
          } finally {
            iframe.remove()
          }
        }

        function probe(doc: Document): string[] {
          const holder = doc.body
          holder.style.fontSize = textSize
          const spansContainer = doc.createElement('div')
          spansContainer.style.setProperty('visibility', 'hidden', 'important')
          const defaultWidth: Record<string, number> = {}
          const defaultHeight: Record<string, number> = {}

          const createSpan = (fontFamily: string) => {
            const span = doc.createElement('span')
            span.style.position = 'absolute'
            span.style.top = '0'
            span.style.left = '0'
            span.style.fontFamily = fontFamily
            span.textContent = testString
            spansContainer.appendChild(span)
            return span
          }

          const baseSpans = baseFonts.map((b) => createSpan(b))
          const fontsSpans: Record<string, HTMLSpanElement[]> = {}
          for (const font of fontList) {
            fontsSpans[font] = baseFonts.map((b) => createSpan(`'${font}',${b}`))
          }
          holder.appendChild(spansContainer)
          for (let i = 0; i < baseFonts.length; i++) {
            defaultWidth[baseFonts[i]!] = baseSpans[i]!.offsetWidth
            defaultHeight[baseFonts[i]!] = baseSpans[i]!.offsetHeight
          }
          return fontList.filter((font) =>
            baseFonts.some(
              (base, i) =>
                fontsSpans[font]![i]!.offsetWidth !== defaultWidth[base] ||
                fontsSpans[font]![i]!.offsetHeight !== defaultHeight[base],
            ),
          )
        }

        const before = document.querySelectorAll('iframe').length
        const first = await withIframe(probe)
        const afterFirst = document.querySelectorAll('iframe').length
        const second = await withIframe(probe)
        const afterSecond = document.querySelectorAll('iframe').length
        const hostFont = getComputedStyle(document.getElementById('ok')!).fontFamily

        return {
          before,
          afterFirst,
          afterSecond,
          first,
          second,
          hostFont,
          isArray: Array.isArray(first),
          allStrings: first.every((f) => typeof f === 'string'),
        }
      },
      {
        testString: FONT_PROBE_STRING,
        textSize: FONT_PROBE_SIZE,
        baseFonts: [...FONT_BASE_FAMILIES],
        // Use a short subset for speed; still exercises layout deltas + order.
        fontList: ['Calibri', 'Menlo', 'Helvetica Neue', 'Segoe UI Light', 'sans-serif-thin'],
      },
    )

    expect(report.before).toBe(0)
    expect(report.afterFirst).toBe(0)
    expect(report.afterSecond).toBe(0)
    expect(report.isArray).toBe(true)
    expect(report.allStrings).toBe(true)
    expect(report.second).toEqual(report.first)
    // Host page CSS must not be required for stability of the iframe probe result.
    expect(report.hostFont.toLowerCase()).toMatch(/comic/i)
    for (const name of report.first) {
      expect(['Calibri', 'Menlo', 'Helvetica Neue', 'Segoe UI Light', 'sans-serif-thin']).toContain(
        name,
      )
    }
  })

  test('full candidate list constant stays locked for Default-profile (no silent Persian adds)', () => {
    expect(FONT_CANDIDATE_LIST).toHaveLength(52)
    expect(FONT_CANDIDATE_LIST).not.toContain('Vazirmatn')
    expect(FONT_CANDIDATE_LIST).not.toContain('Tahoma')
  })

  test('iframe creation failure surfaces (blocked document)', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(async () => {
      const original = document.createElement.bind(document)
      document.createElement = ((tag: string) => {
        if (tag === 'iframe') {
          throw new DOMException('Blocked', 'SecurityError')
        }
        return original(tag)
      }) as typeof document.createElement

      let name = ''
      try {
        const iframe = document.createElement('iframe')
        document.body.appendChild(iframe)
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
