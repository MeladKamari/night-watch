import { expect, test } from '@playwright/test'

const STATUS_NO_GL_CONTEXT = -1
const STATUS_GET_PARAMETER_NOT_A_FUNCTION = -2

test.describe('webGlBasics', () => {
  test('Chromium headless: basics payload or NO_GL; cache reuse; dispose; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate((statuses) => {
      type Cache = { webgl?: { context: WebGLRenderingContext | undefined } }
      const cache: Cache = {}

      const getContext = (c: Cache) => {
        if (c.webgl) return c.webgl.context
        const canvas = document.createElement('canvas')
        let context: WebGLRenderingContext | undefined
        canvas.addEventListener('webglCreateContextError', () => {
          context = undefined
        })
        for (const type of ['webgl', 'experimental-webgl'] as const) {
          try {
            const obtained = canvas.getContext(type) as WebGLRenderingContext | null
            if (obtained) {
              context = obtained
              break
            }
          } catch {
            /* continue */
          }
        }
        c.webgl = { context }
        return context
      }

      const basics = (c: Cache, avoidDebug: boolean) => {
        const gl = getContext(c)
        if (!gl) return statuses.NO_GL
        if (typeof gl.getParameter !== 'function') return statuses.BAD_GET
        const debug = avoidDebug
          ? null
          : (gl.getExtension('WEBGL_debug_renderer_info') as {
              UNMASKED_VENDOR_WEBGL: number
              UNMASKED_RENDERER_WEBGL: number
            } | null)
        return {
          version: gl.getParameter(gl.VERSION)?.toString() || '',
          vendor: gl.getParameter(gl.VENDOR)?.toString() || '',
          vendorUnmasked: debug
            ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)?.toString() || ''
            : '',
          renderer: gl.getParameter(gl.RENDERER)?.toString() || '',
          rendererUnmasked: debug
            ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)?.toString() || ''
            : '',
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)?.toString() || '',
        }
      }

      const first = basics(cache, false)
      const second = basics(cache, false)
      const sameContext = cache.webgl?.context === getContext(cache)

      let lost = false
      if (cache.webgl?.context) {
        const lose = cache.webgl.context.getExtension('WEBGL_lose_context') as {
          loseContext?: () => void
        } | null
        if (lose?.loseContext) {
          lose.loseContext()
          lost = true
        }
        cache.webgl = { context: undefined }
      }

      return {
        first,
        second,
        sameContext,
        lost,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, { NO_GL: STATUS_NO_GL_CONTEXT, BAD_GET: STATUS_GET_PARAMETER_NOT_A_FUNCTION })

    expect(report.hostRtl).toBe('rtl')
    expect(report.sameContext).toBe(true)
    expect(report.first).toEqual(report.second)

    if (typeof report.first === 'number') {
      expect(report.first).toBe(STATUS_NO_GL_CONTEXT)
    } else {
      expect(report.first.version.toLowerCase()).toContain('webgl')
      expect(report.first.vendor.length).toBeGreaterThan(0)
      expect(report.first.renderer.length).toBeGreaterThan(0)
      expect(typeof report.first.shadingLanguageVersion).toBe('string')
      // Unmasked may be empty under privacy / missing extension
      expect(typeof report.first.vendorUnmasked).toBe('string')
      expect(typeof report.first.rendererUnmasked).toBe('string')
    }
  })

  test('no WebGL / getParameter missing / masked debug; context loss path', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((statuses) => {
      const noGlDoc = {
        createElement() {
          return {
            addEventListener() {},
            getContext: () => null,
          }
        },
      }

      const badGetDoc = {
        createElement() {
          return {
            addEventListener() {},
            getContext: () => ({}),
          }
        },
      }

      const run = (
        doc: { createElement: () => { getContext: (t: string) => unknown; addEventListener: () => void } },
      ) => {
        const canvas = doc.createElement()
        let context: { getParameter?: unknown } | null | undefined
        for (const type of ['webgl', 'experimental-webgl']) {
          try {
            context = canvas.getContext(type) as { getParameter?: unknown } | null
          } catch {
            context = null
          }
          if (context) break
        }
        if (!context) return statuses.NO_GL
        if (typeof context.getParameter !== 'function') return statuses.BAD_GET
        return 'ok'
      }

      const masked = {
        vendorUnmasked: '',
        rendererUnmasked: '',
      }

      return {
        noGl: run(noGlDoc),
        badGet: run(badGetDoc),
        masked,
      }
    }, { NO_GL: STATUS_NO_GL_CONTEXT, BAD_GET: STATUS_GET_PARAMETER_NOT_A_FUNCTION })

    expect(report.noGl).toBe(STATUS_NO_GL_CONTEXT)
    expect(report.badGet).toBe(STATUS_GET_PARAMETER_NOT_A_FUNCTION)
    expect(report.masked.vendorUnmasked).toBe('')
    expect(report.masked.rendererUnmasked).toBe('')
  })
})
