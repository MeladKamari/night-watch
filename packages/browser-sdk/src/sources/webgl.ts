import {
  getDocument,
  isChromium,
  isGecko,
  isWebKit,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'

/** WebGL context is not available. */
export const STATUS_NO_GL_CONTEXT = -1
/** WebGL context `getParameter` method is not a function. */
export const STATUS_GET_PARAMETER_NOT_A_FUNCTION = -2

export type WebGlSpecialStatus =
  | typeof STATUS_NO_GL_CONTEXT
  | typeof STATUS_GET_PARAMETER_NOT_A_FUNCTION

/** WebGL basic features (FingerprintJS OSS v5.3.0 shape). */
export type WebGlBasicsPayload = {
  version: string
  vendor: string
  vendorUnmasked: string
  renderer: string
  rendererUnmasked: string
  shadingLanguageVersion: string
}

export type WebGlBasicsResult = WebGlBasicsPayload | WebGlSpecialStatus

/** WebGL extended features (FingerprintJS OSS v5.3.0 shape). */
export type WebGlExtensionsPayload = {
  contextAttributes: string[]
  parameters: string[]
  shaderPrecisions: string[]
  extensions: string[] | null
  extensionParameters: string[]
  unsupportedExtensions: string[]
}

export type WebGlExtensionsResult = WebGlExtensionsPayload | WebGlSpecialStatus

type CanvasContext = WebGLRenderingContext & { readonly canvas: HTMLCanvasElement }

/** Cached GL context slot shared by `webGlBasics` and `webGlExtensions`. */
export type WebGlCacheEntry = {
  context: CanvasContext | undefined
}

export type WebGlCacheBag = {
  webgl?: WebGlCacheEntry
}

/**
 * Allowlisted context parameter enums (upstream v5.3.0).
 * SAMPLE_ALPHA_TO_COVERAGE / SAMPLE_COVERAGE excluded (console warnings, no entropy).
 */
const VALID_CONTEXT_PARAMETERS = new Set([
  10752, 2849, 2884, 2885, 2886, 2928, 2929, 2930, 2931, 2932, 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968,
  2978, 3024, 3042, 3088, 3089, 3106, 3107, 32773, 32777, 32777, 32823, 32824, 32936, 32937, 32938, 32939, 32968, 32969,
  32970, 32971, 3317, 33170, 3333, 3379, 3386, 33901, 33902, 34016, 34024, 34076, 3408, 3410, 3411, 3412, 3413, 3414,
  3415, 34467, 34816, 34817, 34818, 34819, 34877, 34921, 34930, 35660, 35661, 35724, 35738, 35739, 36003, 36004, 36005,
  36347, 36348, 36349, 37440, 37441, 37443, 7936, 7937, 7938,
])

const VALID_EXTENSION_PARAMS = new Set([
  34047, // MAX_TEXTURE_MAX_ANISOTROPY_EXT
  35723, // FRAGMENT_SHADER_DERIVATIVE_HINT_OES
  36063, // MAX_COLOR_ATTACHMENTS_WEBGL
  34852, // MAX_DRAW_BUFFERS_WEBGL
  34853, // DRAW_BUFFER0_WEBGL
  34854, // DRAW_BUFFER1_WEBGL
  34229, // VERTEX_ARRAY_BINDING_OES
  36392, // TIMESTAMP_EXT
  36795, // GPU_DISJOINT_EXT
  38449, // MAX_VIEWS_OVR
])

const SHADER_TYPES = ['FRAGMENT_SHADER', 'VERTEX_SHADER'] as const
const PRECISION_TYPES = [
  'LOW_FLOAT',
  'MEDIUM_FLOAT',
  'HIGH_FLOAT',
  'LOW_INT',
  'MEDIUM_INT',
  'HIGH_INT',
] as const

const RENDERER_INFO_EXTENSION = 'WEBGL_debug_renderer_info'
const POLYGON_MODE_EXTENSION = 'WEBGL_polygon_mode'

export type WebGlBasicsOptions = BuiltinSourceOptions & {
  /** Inject document for canvas creation (tests). */
  document?: Document | null
  /**
   * Override debug-renderer avoidance (`isGecko()` by default).
   * When true, unmasked vendor/renderer stay empty strings.
   */
  avoidDebugRendererInfo?: boolean
}

export type WebGlExtensionsOptions = BuiltinSourceOptions & {
  /** Inject document for canvas creation (tests). */
  document?: Document | null
  /** Override debug-renderer skip (default: {@link shouldAvoidDebugRendererInfo}). */
  avoidDebugRendererInfo?: boolean
  /** Override polygon-mode skip (default: {@link shouldAvoidPolygonModeExtensions}). */
  avoidPolygonModeExtensions?: boolean
}

/**
 * Gets basic WebGL parameters (version / vendor / renderer / GLSL).
 * Shares a cached context via `options.cache.webgl` with extensions (step 53).
 */
export function getWebGlBasicsValue(options: WebGlBasicsOptions): WebGlBasicsResult {
  const gl = getWebGLContext(
    options.cache as WebGlCacheBag,
    'document' in options ? { document: options.document } : {},
  )
  if (!gl) {
    return STATUS_NO_GL_CONTEXT
  }

  if (!isValidParameterGetter(gl)) {
    return STATUS_GET_PARAMETER_NOT_A_FUNCTION
  }

  const avoidDebug =
    options.avoidDebugRendererInfo !== undefined
      ? options.avoidDebugRendererInfo
      : shouldAvoidDebugRendererInfo()

  const debugExtension = avoidDebug
    ? null
    : (gl.getExtension(RENDERER_INFO_EXTENSION) as {
        UNMASKED_VENDOR_WEBGL: number
        UNMASKED_RENDERER_WEBGL: number
      } | null)

  return {
    version: gl.getParameter(gl.VERSION)?.toString() || '',
    vendor: gl.getParameter(gl.VENDOR)?.toString() || '',
    vendorUnmasked: debugExtension
      ? gl.getParameter(debugExtension.UNMASKED_VENDOR_WEBGL)?.toString() || ''
      : '',
    renderer: gl.getParameter(gl.RENDERER)?.toString() || '',
    rendererUnmasked: debugExtension
      ? gl.getParameter(debugExtension.UNMASKED_RENDERER_WEBGL)?.toString() || ''
      : '',
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)?.toString() || '',
  }
}

/**
 * Creates or returns a cached WebGL context.
 * Usually the most expensive step among entropy sources — result is cached.
 *
 * Tries `webgl` then `experimental-webgl` (upstream order; not webgl2).
 */
export function getWebGLContext(
  cache: WebGlCacheBag,
  options: { document?: Document | null } = {},
): CanvasContext | undefined {
  if (cache.webgl) {
    return cache.webgl.context
  }

  let documentRef = options.document
  if (documentRef === undefined) {
    const probe = getDocument()
    if (probe.status !== 'ok') {
      cache.webgl = { context: undefined }
      return undefined
    }
    documentRef = probe.value
  }
  if (documentRef == null) {
    cache.webgl = { context: undefined }
    return undefined
  }

  const canvas = documentRef.createElement('canvas')
  let context: CanvasContext | undefined

  canvas.addEventListener('webglCreateContextError', () => {
    context = undefined
  })

  for (const type of ['webgl', 'experimental-webgl'] as const) {
    try {
      const obtained = canvas.getContext(type) as CanvasContext | null
      if (obtained) {
        context = obtained
        break
      }
    } catch {
      // continue
    }
  }

  cache.webgl = { context }
  return context
}

/**
 * Releases a cached WebGL context (lose-context + clear slot).
 * Upstream leaves the cache for the agent lifetime; call explicitly in tests / after both WebGL sources.
 */
export function disposeWebGlCache(cache: WebGlCacheBag): void {
  const entry = cache.webgl
  if (!entry) {
    return
  }
  const gl = entry.context
  if (gl) {
    try {
      const lose = gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null
      if (lose && typeof lose.loseContext === 'function') {
        lose.loseContext()
      }
    } catch {
      // ignore
    }
    try {
      const canvas = gl.canvas
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    } catch {
      // ignore
    }
  }
  cache.webgl = { context: undefined }
}

/**
 * Gets advanced WebGL parameters, extensions, and shader precisions.
 * Shares `options.cache.webgl` with {@link getWebGlBasicsValue}.
 * Sorts `parameters` and `extensionParameters` for stable hashing.
 */
export function getWebGlExtensionsValue(
  options: WebGlExtensionsOptions,
): WebGlExtensionsResult {
  const gl = getWebGLContext(
    options.cache as WebGlCacheBag,
    'document' in options ? { document: options.document } : {},
  )
  if (!gl) {
    return STATUS_NO_GL_CONTEXT
  }

  if (!isValidParameterGetter(gl)) {
    return STATUS_GET_PARAMETER_NOT_A_FUNCTION
  }

  const avoidDebug =
    options.avoidDebugRendererInfo !== undefined
      ? options.avoidDebugRendererInfo
      : shouldAvoidDebugRendererInfo()
  const avoidPolygon =
    options.avoidPolygonModeExtensions !== undefined
      ? options.avoidPolygonModeExtensions
      : shouldAvoidPolygonModeExtensions()

  const extensions = gl.getSupportedExtensions()
  const contextAttributes = gl.getContextAttributes()
  const unsupportedExtensions: string[] = []
  const attributes: string[] = []
  const parameters: string[] = []
  const extensionParameters: string[] = []
  const shaderPrecisions: string[] = []

  if (contextAttributes) {
    for (const attributeName of Object.keys(contextAttributes) as (keyof WebGLContextAttributes)[]) {
      attributes.push(`${attributeName}=${contextAttributes[attributeName]}`)
    }
  }

  const glConsts = gl as unknown as Record<string, number>
  const constants = getConstantsFromPrototype(gl)
  for (const constant of constants) {
    const code = glConsts[constant] as number
    parameters.push(
      `${constant}=${code}${VALID_CONTEXT_PARAMETERS.has(code) ? `=${gl.getParameter(code)}` : ''}`,
    )
  }

  if (extensions) {
    for (const name of extensions) {
      if (
        (name === RENDERER_INFO_EXTENSION && avoidDebug) ||
        (name === POLYGON_MODE_EXTENSION && avoidPolygon)
      ) {
        continue
      }

      const extension = gl.getExtension(name)
      if (!extension) {
        unsupportedExtensions.push(name)
        continue
      }

      const extConsts = extension as unknown as Record<string, number>
      for (const constant of getConstantsFromPrototype(extension)) {
        const code = extConsts[constant] as number
        extensionParameters.push(
          `${constant}=${code}${VALID_EXTENSION_PARAMS.has(code) ? `=${gl.getParameter(code)}` : ''}`,
        )
      }
    }
  }

  for (const shaderType of SHADER_TYPES) {
    for (const precisionType of PRECISION_TYPES) {
      const shaderPrecision = getShaderPrecision(gl, shaderType, precisionType)
      shaderPrecisions.push(`${shaderType}.${precisionType}=${shaderPrecision.join(',')}`)
    }
  }

  extensionParameters.sort()
  parameters.sort()

  return {
    contextAttributes: attributes,
    parameters,
    shaderPrecisions,
    extensions,
    extensionParameters,
    unsupportedExtensions,
  }
}

function getShaderPrecision(
  gl: WebGLRenderingContext,
  shaderType: (typeof SHADER_TYPES)[number],
  precisionType: (typeof PRECISION_TYPES)[number],
): number[] {
  const glConsts = gl as unknown as Record<string, number>
  const shaderPrecision = gl.getShaderPrecisionFormat(
    glConsts[shaderType] as number,
    glConsts[precisionType] as number,
  )
  return shaderPrecision
    ? [shaderPrecision.rangeMin, shaderPrecision.rangeMax, shaderPrecision.precision]
    : []
}

/**
 * Collect CONSTANT_LIKE keys from an object's prototype (upstream behavior).
 */
export function getConstantsFromPrototype(obj: object): string[] {
  const proto = Object.getPrototypeOf(obj) as object | null
  if (proto == null) {
    return []
  }
  return (Object.keys(proto) as string[]).filter(isConstantLike)
}

function isConstantLike(key: string): boolean {
  return !/[^A-Z0-9_x]/.test(key)
}

/**
 * Gecko prints a console warning when `WEBGL_debug_renderer_info` is requested.
 * Avoid the extension there so unmasked fields stay empty / extension is skipped.
 */
export function shouldAvoidDebugRendererInfo(): boolean {
  return isGecko()
}

/**
 * Chromium and WebKit warn when `WEBGL_polygon_mode` is requested — skip it.
 */
export function shouldAvoidPolygonModeExtensions(): boolean {
  return isChromium() || isWebKit()
}

function isValidParameterGetter(gl: WebGLRenderingContext): boolean {
  return typeof gl.getParameter === 'function'
}

/** Entropy source: WebGL basics (version / vendor / renderer / GLSL). */
export const getWebGlBasics: Source<BuiltinSourceOptions, WebGlBasicsResult> = (options) =>
  getWebGlBasicsValue(options)

/** Entropy source: WebGL extensions / parameters / shader precision. */
export const getWebGlExtensions: Source<BuiltinSourceOptions, WebGlExtensionsResult> = (options) =>
  getWebGlExtensionsValue(options)
