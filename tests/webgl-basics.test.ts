import {
  STATUS_GET_PARAMETER_NOT_A_FUNCTION,
  STATUS_NO_GL_CONTEXT,
  componentsToCanonicalString,
  createBuiltinSources,
  disposeWebGlCache,
  getWebGLContext,
  getWebGlBasics,
  getWebGlBasicsValue,
  hashComponents,
  isValueComponent,
  load,
  shouldAvoidDebugRendererInfo,
  type WebGlBasicsPayload,
  type WebGlCacheBag,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

function mockDocument(getContextImpl: (type: string) => unknown): Document {
  return {
    createElement(_tag: string) {
      return {
        addEventListener() {
          /* no-op */
        },
        getContext: getContextImpl,
        width: 0,
        height: 0,
      }
    },
  } as unknown as Document
}

describe('getWebGlBasicsValue / getWebGLContext', () => {
  it('returns STATUS_NO_GL_CONTEXT when canvas/getContext yields nothing', () => {
    const cache: WebGlCacheBag = {}
    const value = getWebGlBasicsValue({
      cache: cache as Record<string, unknown>,
      document: mockDocument(() => null),
    })
    expect(value).toBe(STATUS_NO_GL_CONTEXT)
    expect(cache.webgl?.context).toBeUndefined()
  })

  it('returns STATUS_GET_PARAMETER_NOT_A_FUNCTION when getParameter missing', () => {
    const cache: WebGlCacheBag = {}
    const value = getWebGlBasicsValue({
      cache: cache as Record<string, unknown>,
      document: mockDocument(() => ({
        // no getParameter
        getExtension: () => null,
        VERSION: 0x1f02,
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
        SHADING_LANGUAGE_VERSION: 0x8b8c,
        canvas: { width: 0, height: 0 },
      })),
    })
    expect(value).toBe(STATUS_GET_PARAMETER_NOT_A_FUNCTION)
  })

  it('reads basics; private GPU / avoided debug → empty unmasked strings', () => {
    const cache: WebGlCacheBag = {}
    const gl = {
      VERSION: 0x1f02,
      VENDOR: 0x1f00,
      RENDERER: 0x1f01,
      SHADING_LANGUAGE_VERSION: 0x8b8c,
      getParameter(code: number) {
        if (code === this.VERSION) return 'WebGL 1.0'
        if (code === this.VENDOR) return 'WebKit'
        if (code === this.RENDERER) return 'WebKit WebGL'
        if (code === this.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 1.0'
        if (code === 0x9245) return 'Apple'
        if (code === 0x9246) return 'Apple M1'
        return null
      },
      getExtension(name: string) {
        if (name === 'WEBGL_debug_renderer_info') {
          return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 }
        }
        return null
      },
      canvas: { width: 0, height: 0 },
    }
    const masked = getWebGlBasicsValue({
      cache: cache as Record<string, unknown>,
      document: mockDocument(() => gl),
      avoidDebugRendererInfo: true,
    })
    expect(masked).toEqual({
      version: 'WebGL 1.0',
      vendor: 'WebKit',
      vendorUnmasked: '',
      renderer: 'WebKit WebGL',
      rendererUnmasked: '',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0',
    } satisfies WebGlBasicsPayload)

    const cache2: WebGlCacheBag = {}
    const unmasked = getWebGlBasicsValue({
      cache: cache2 as Record<string, unknown>,
      document: mockDocument(() => gl),
      avoidDebugRendererInfo: false,
    }) as WebGlBasicsPayload
    expect(unmasked.vendorUnmasked).toBe('Apple')
    expect(unmasked.rendererUnmasked).toBe('Apple M1')
  })

  it('shares cached context across calls; dispose clears + loseContext', () => {
    let created = 0
    let lost = 0
    const gl = {
      getParameter: () => 'x',
      VERSION: 1,
      VENDOR: 2,
      RENDERER: 3,
      SHADING_LANGUAGE_VERSION: 4,
      getExtension(name: string) {
        if (name === 'WEBGL_lose_context') {
          return {
            loseContext() {
              lost += 1
            },
          }
        }
        return null
      },
      canvas: { width: 10, height: 10 },
    }
    const doc = mockDocument((type) => {
      if (type === 'webgl') {
        created += 1
        return gl
      }
      return null
    })
    const cache: WebGlCacheBag = {}
    const a = getWebGLContext(cache, { document: doc })
    const b = getWebGLContext(cache, { document: doc })
    expect(a).toBe(b)
    expect(created).toBe(1)

    disposeWebGlCache(cache)
    expect(lost).toBe(1)
    expect(cache.webgl?.context).toBeUndefined()
    expect(gl.canvas.width).toBe(0)
  })

  it('Node / no document → STATUS_NO_GL_CONTEXT', () => {
    expect(getWebGlBasicsValue({ cache: {} })).toBe(STATUS_NO_GL_CONTEXT)
  })

  it('shouldAvoidDebugRendererInfo is boolean (Gecko → true)', () => {
    expect(typeof shouldAvoidDebugRendererInfo()).toBe('boolean')
  })
})

describe('builtin webGlBasics wiring', () => {
  it('wires webGlBasics as source #40; Node yields NO_GL_CONTEXT', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[39]).toBe('webGlBasics')
    expect(sources.webGlBasics).toBe(getWebGlBasics)
    // Extensions still stubbed until step 53
    expect(Object.keys(sources)[40]).toBe('webGlExtensions')

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.webGlBasics)).toBe(true)
    if (isValueComponent(result.components.webGlBasics)) {
      expect(result.components.webGlBasics.value).toBe(STATUS_NO_GL_CONTEXT)
    }

    expect(
      componentsToCanonicalString({
        webGlBasics: { value: STATUS_NO_GL_CONTEXT, duration: 1 },
      }),
    ).toContain('webGlBasics:')
    expect(
      hashComponents({
        webGlBasics: { value: STATUS_GET_PARAMETER_NOT_A_FUNCTION, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
