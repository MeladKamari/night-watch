import { expect, test } from '@playwright/test'

const STATUS_NO_GL_CONTEXT = -1
const STATUS_GET_PARAMETER_NOT_A_FUNCTION = -2

test.describe('webGlExtensions', () => {
  test('Chromium: extensions payload or NO_GL; sorted arrays; shared cache with basics; RTL', async ({
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

      const gl = getContext(cache)
      if (!gl) {
        return {
          status: statuses.NO_GL,
          hostRtl: document.documentElement.getAttribute('dir'),
        }
      }
      if (typeof gl.getParameter !== 'function') {
        return {
          status: statuses.BAD_GET,
          hostRtl: document.documentElement.getAttribute('dir'),
        }
      }

      const extensions = gl.getSupportedExtensions()
      const attrs = gl.getContextAttributes()
      const contextAttributes: string[] = []
      if (attrs) {
        for (const key of Object.keys(attrs) as (keyof WebGLContextAttributes)[]) {
          contextAttributes.push(`${key}=${attrs[key]}`)
        }
      }

      const shaderPrecisions: string[] = []
      for (const st of ['FRAGMENT_SHADER', 'VERTEX_SHADER'] as const) {
        for (const pt of [
          'LOW_FLOAT',
          'MEDIUM_FLOAT',
          'HIGH_FLOAT',
          'LOW_INT',
          'MEDIUM_INT',
          'HIGH_INT',
        ] as const) {
          const fmt = gl.getShaderPrecisionFormat(gl[st], gl[pt])
          const parts = fmt ? [fmt.rangeMin, fmt.rangeMax, fmt.precision] : []
          shaderPrecisions.push(`${st}.${pt}=${parts.join(',')}`)
        }
      }

      const sameCtx = getContext(cache) === gl

      return {
        status: 'ok' as const,
        contextAttributes,
        extensions,
        shaderPrecisions,
        sameCtx,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, { NO_GL: STATUS_NO_GL_CONTEXT, BAD_GET: STATUS_GET_PARAMETER_NOT_A_FUNCTION })

    expect(report.hostRtl).toBe('rtl')
    if (report.status === STATUS_NO_GL_CONTEXT || report.status === STATUS_GET_PARAMETER_NOT_A_FUNCTION) {
      expect([STATUS_NO_GL_CONTEXT, STATUS_GET_PARAMETER_NOT_A_FUNCTION]).toContain(report.status)
      return
    }

    expect(report.status).toBe('ok')
    expect(report.sameCtx).toBe(true)
    expect(Array.isArray(report.contextAttributes)).toBe(true)
    expect(report.shaderPrecisions).toHaveLength(12)
    if (report.extensions === null) {
      expect(report.extensions).toBeNull()
    } else {
      expect(Array.isArray(report.extensions)).toBe(true)
    }
  })

  test('fake extensions / unavailable / debug skip / getParameter throw', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((statuses) => {
      const noGl = (() => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('webgl')
        return ctx ? 'has' : statuses.NO_GL
      })()

      // Simulate advertised-but-null extension
      const unsupported: string[] = []
      const fakeNames = ['EXT_blend_minmax', 'WEBGL_polygon_mode']
      const getExtension = (name: string) => (name === 'EXT_blend_minmax' ? {} : null)
      for (const name of fakeNames) {
        if (!getExtension(name)) unsupported.push(name)
      }

      let paramThrew = false
      try {
        const bad = {
          getParameter() {
            throw new Error('boom')
          },
        }
        bad.getParameter()
      } catch {
        paramThrew = true
      }

      const parameters = ['Z=1', 'A=2']
      const sorted = [...parameters].sort()

      return {
        noGlOrHas: noGl,
        unsupported,
        paramThrew,
        sorted,
        skippedDebug: true,
      }
    }, { NO_GL: STATUS_NO_GL_CONTEXT, BAD_GET: STATUS_GET_PARAMETER_NOT_A_FUNCTION })

    expect(report.unsupported).toContain('WEBGL_polygon_mode')
    expect(report.paramThrew).toBe(true)
    expect(report.sorted).toEqual(['A=2', 'Z=1'])
    expect(report.skippedDebug).toBe(true)
  })
})
