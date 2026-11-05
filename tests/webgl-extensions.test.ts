import {
  STATUS_GET_PARAMETER_NOT_A_FUNCTION,
  STATUS_NO_GL_CONTEXT,
  componentsToCanonicalString,
  createBuiltinSources,
  getConstantsFromPrototype,
  getWebGlBasics,
  getWebGlExtensions,
  getWebGlExtensionsValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  shouldAvoidPolygonModeExtensions,
  type WebGlCacheBag,
  type WebGlExtensionsPayload,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

/** Prototype-held GL constants (matches WebGLRenderingContext layout). */
function FakeGlProto(this: Record<string, unknown>) {
  /* instance methods assigned below */
}
FakeGlProto.prototype.ACTIVE_TEXTURE = 33984
FakeGlProto.prototype.VERSION = 0x1f02
FakeGlProto.prototype.FRAGMENT_SHADER = 0x8b30
FakeGlProto.prototype.VERTEX_SHADER = 0x8b31
FakeGlProto.prototype.LOW_FLOAT = 0x8df0
FakeGlProto.prototype.MEDIUM_FLOAT = 0x8df1
FakeGlProto.prototype.HIGH_FLOAT = 0x8df2
FakeGlProto.prototype.LOW_INT = 0x8df3
FakeGlProto.prototype.MEDIUM_INT = 0x8df4
FakeGlProto.prototype.HIGH_INT = 0x8df5

function FakeExtProto() {
  /* empty */
}
FakeExtProto.prototype.MAX_TEXTURE_MAX_ANISOTROPY_EXT = 34047
FakeExtProto.prototype.SOME_OTHER_CONST = 1

function mockDocument(getContextImpl: (type: string) => unknown): Document {
  return {
    createElement() {
      return {
        addEventListener() {},
        getContext: getContextImpl,
        width: 0,
        height: 0,
      }
    },
  } as unknown as Document
}

function makeGl(overrides: Record<string, unknown> = {}): object {
  const gl = Object.create(FakeGlProto.prototype) as Record<string, unknown>
  Object.assign(gl, {
    getParameter(code: number) {
      if (code === 33984) return 0
      if (code === 34047) return 16
      return null
    },
    getContextAttributes() {
      return { alpha: true, antialias: true }
    },
    getSupportedExtensions() {
      return ['EXT_blend_minmax', 'WEBGL_debug_renderer_info', 'WEBGL_polygon_mode']
    },
    getExtension(name: string) {
      if (name === 'EXT_blend_minmax') {
        return Object.create(FakeExtProto.prototype)
      }
      if (name === 'WEBGL_debug_renderer_info') {
        return Object.create(FakeExtProto.prototype)
      }
      if (name === 'WEBGL_polygon_mode') {
        return null // advertised but unavailable
      }
      return null
    },
    getShaderPrecisionFormat() {
      return { rangeMin: 127, rangeMax: 127, precision: 23 }
    },
    canvas: { width: 0, height: 0 },
    ...overrides,
  })
  return gl
}

/** ACTIVE_TEXTURE (33984) is not in the context allowlist; use an allowlisted code for throw tests. */
function makeGlWithAllowlistedParamThrow(): object {
  function Proto() {}
  // 2849 = LINE_WIDTH — in VALID_CONTEXT_PARAMETERS
  Proto.prototype.LINE_WIDTH = 2849
  Proto.prototype.FRAGMENT_SHADER = 0x8b30
  Proto.prototype.VERTEX_SHADER = 0x8b31
  Proto.prototype.LOW_FLOAT = 0x8df0
  Proto.prototype.MEDIUM_FLOAT = 0x8df1
  Proto.prototype.HIGH_FLOAT = 0x8df2
  Proto.prototype.LOW_INT = 0x8df3
  Proto.prototype.MEDIUM_INT = 0x8df4
  Proto.prototype.HIGH_INT = 0x8df5
  const gl = Object.create(Proto.prototype) as Record<string, unknown>
  Object.assign(gl, {
    getParameter() {
      throw new Error('param boom')
    },
    getContextAttributes: () => null,
    getSupportedExtensions: () => [],
    getExtension: () => null,
    getShaderPrecisionFormat: () => null,
    canvas: { width: 0, height: 0 },
  })
  return gl
}

describe('getWebGlExtensionsValue', () => {
  it('returns STATUS_NO_GL_CONTEXT when GL missing', () => {
    expect(
      getWebGlExtensionsValue({
        cache: {},
        document: mockDocument(() => null),
      }),
    ).toBe(STATUS_NO_GL_CONTEXT)
  })

  it('returns STATUS_GET_PARAMETER_NOT_A_FUNCTION when getParameter missing', () => {
    expect(
      getWebGlExtensionsValue({
        cache: {},
        document: mockDocument(() => ({
          getSupportedExtensions: () => [],
          getContextAttributes: () => null,
          getExtension: () => null,
          getShaderPrecisionFormat: () => null,
          canvas: {},
        })),
      }),
    ).toBe(STATUS_GET_PARAMETER_NOT_A_FUNCTION)
  })

  it('collects attributes, sorted parameters, extensions, unsupported; skips blocked debug/polygon', () => {
    const cache: WebGlCacheBag = {}
    const result = getWebGlExtensionsValue({
      cache: cache as Record<string, unknown>,
      document: mockDocument(() => makeGl()),
      avoidDebugRendererInfo: true,
      avoidPolygonModeExtensions: true,
    })
    expect(typeof result).toBe('object')
    const payload = result as WebGlExtensionsPayload
    expect(payload.contextAttributes).toEqual(
      expect.arrayContaining(['alpha=true', 'antialias=true']),
    )
    expect(payload.extensions).toEqual([
      'EXT_blend_minmax',
      'WEBGL_debug_renderer_info',
      'WEBGL_polygon_mode',
    ])
    // Debug + polygon skipped → not in unsupported; polygon would be unsupported if not skipped
    expect(payload.unsupportedExtensions).not.toContain('WEBGL_debug_renderer_info')
    expect(payload.unsupportedExtensions).not.toContain('WEBGL_polygon_mode')
    expect([...payload.parameters]).toEqual([...payload.parameters].sort())
    expect([...payload.extensionParameters]).toEqual([...payload.extensionParameters].sort())
    expect(payload.shaderPrecisions.length).toBe(12)
    expect(payload.shaderPrecisions[0]).toMatch(/^FRAGMENT_SHADER\.LOW_FLOAT=/)
  })

  it('fake getSupportedExtensions null → extensions null; unavailable extension listed', () => {
    const result = getWebGlExtensionsValue({
      cache: {},
      document: mockDocument(() =>
        makeGl({
          getSupportedExtensions: () => ['EXT_blend_minmax', 'WEBGL_polygon_mode'],
          getExtension(name: string) {
            if (name === 'EXT_blend_minmax') return Object.create(FakeExtProto.prototype)
            return null
          },
        }),
      ),
      avoidDebugRendererInfo: false,
      avoidPolygonModeExtensions: false,
    }) as WebGlExtensionsPayload
    expect(result.unsupportedExtensions).toContain('WEBGL_polygon_mode')

    const nullExts = getWebGlExtensionsValue({
      cache: {},
      document: mockDocument(() =>
        makeGl({
          getSupportedExtensions: () => null,
        }),
      ),
      avoidDebugRendererInfo: true,
      avoidPolygonModeExtensions: true,
    }) as WebGlExtensionsPayload
    expect(nullExts.extensions).toBeNull()
  })

  it('getParameter throw surfaces to loadSource error path', async () => {
    const source: Source<BuiltinSourceOptions, WebGlExtensionsPayload | number> = (options) =>
      getWebGlExtensionsValue({
        ...options,
        document: mockDocument(() => makeGlWithAllowlistedParamThrow()),
        avoidDebugRendererInfo: true,
        avoidPolygonModeExtensions: true,
      })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })

  it('getConstantsFromPrototype only returns CONSTANT_LIKE keys', () => {
    function Proto() {}
    Proto.prototype.ACTIVE_TEXTURE = 1
    Proto.prototype.getParameter = function getParameter() {
      return null
    }
    Proto.prototype.lowercase = 2
    const obj = Object.create(Proto.prototype)
    expect(getConstantsFromPrototype(obj)).toEqual(['ACTIVE_TEXTURE'])
  })

  it('shouldAvoidPolygonModeExtensions is boolean', () => {
    expect(typeof shouldAvoidPolygonModeExtensions()).toBe('boolean')
  })
})

describe('builtin webGlExtensions wiring', () => {
  it('wires webGlExtensions as source #41; Node → NO_GL; shares registry with basics', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[40]).toBe('webGlExtensions')
    expect(sources.webGlExtensions).toBe(getWebGlExtensions)
    expect(sources.webGlBasics).toBe(getWebGlBasics)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.webGlExtensions)).toBe(true)
    if (isValueComponent(result.components.webGlExtensions)) {
      expect(result.components.webGlExtensions.value).toBe(STATUS_NO_GL_CONTEXT)
    }

    expect(
      componentsToCanonicalString({
        webGlExtensions: { value: STATUS_NO_GL_CONTEXT, duration: 1 },
      }),
    ).toContain('webGlExtensions:')
    expect(
      hashComponents({
        webGlExtensions: { value: STATUS_GET_PARAMETER_NOT_A_FUNCTION, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
