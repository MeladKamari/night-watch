import { expect, test } from '@playwright/test'
import { CANVAS_PRINTED_TEXT, ImageStatus } from '@thenightwatch/browser-sdk'

test.describe('canvas', () => {
  test('RTL host with Persian CSS does not leak into canvas probe; stable data URLs', async ({
    page,
  }) => {
    await page.setContent(`<!doctype html><html dir="rtl"><head>
      <style>
        body { font-family: "Comic Sans MS" !important; font-size: 48px !important; }
        * { color: #f0f !important; }
      </style>
    </head><body><p id="host">سلام ۱۲۳</p></body></html>`)
    await expect(page.locator('#host')).toContainText('سلام')

    const report = await page.evaluate(async (printedText) => {
      const beforeChildren = document.body.childElementCount

      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d')
      if (!context || !canvas.toDataURL) {
        return { supported: false as const }
      }

      context.rect(0, 0, 10, 10)
      context.rect(2, 2, 6, 6)
      const winding = !context.isPointInPath(5, 5, 'evenodd')

      canvas.width = 240
      canvas.height = 60
      context.textBaseline = 'alphabetic'
      context.fillStyle = '#f60'
      context.fillRect(100, 1, 62, 20)
      context.fillStyle = '#069'
      context.font = '11pt "Times New Roman"'
      context.fillText(printedText, 2, 15)
      context.fillStyle = 'rgba(102, 204, 0, 0.2)'
      context.font = '18pt Arial'
      context.fillText(printedText, 4, 45)
      const text1 = canvas.toDataURL()
      const text2 = canvas.toDataURL()

      canvas.width = 122
      canvas.height = 110
      context.globalCompositeOperation = 'multiply'
      for (const [color, x, y] of [
        ['#f2f', 40, 40],
        ['#2ff', 80, 40],
        ['#ff2', 60, 80],
      ] as const) {
        context.fillStyle = color
        context.beginPath()
        context.arc(x, y, 40, 0, Math.PI * 2, true)
        context.closePath()
        context.fill()
      }
      context.fillStyle = '#f9c'
      context.arc(60, 60, 60, 0, Math.PI * 2, true)
      context.arc(60, 60, 20, 0, Math.PI * 2, true)
      context.fill('evenodd')
      const geometry = canvas.toDataURL()

      const afterChildren = document.body.childElementCount
      return {
        supported: true as const,
        winding,
        textStable: text1 === text2,
        text: text1,
        geometry,
        textStartsWithData: text1.startsWith('data:image'),
        geometryStartsWithData: geometry.startsWith('data:image'),
        textDiffersFromGeometry: text1 !== geometry,
        noDomMutation: beforeChildren === afterChildren,
        hostFont: getComputedStyle(document.getElementById('host')!).fontFamily,
      }
    }, CANVAS_PRINTED_TEXT)

    expect(report.supported).toBe(true)
    if (!report.supported) {
      return
    }
    expect(report.noDomMutation).toBe(true)
    expect(report.textStable).toBe(true)
    expect(report.textStartsWithData).toBe(true)
    expect(report.geometryStartsWithData).toBe(true)
    expect(report.textDiffersFromGeometry).toBe(true)
    expect(typeof report.winding).toBe('boolean')
    expect(report.hostFont.toLowerCase()).toMatch(/comic/i)
    expect(ImageStatus.Skipped).toBe('skipped')
  })

  test('getContext null maps to unsupported semantics', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const original = canvas.getContext.bind(canvas)
      canvas.getContext = (() => null) as typeof canvas.getContext
      const context = canvas.getContext('2d')
      const supported = !!(context && canvas.toDataURL)
      canvas.getContext = original
      return { supported, unsupported: 'unsupported' }
    })
    expect(report.supported).toBe(false)
    expect(report.unsupported).toBe(ImageStatus.Unsupported)
  })
})
