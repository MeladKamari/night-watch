import {
  blocked,
  isBlockedBrowserError,
  ok,
  probeError,
  runProbe,
  unsupported,
  type ProbeResult,
} from './probe.js'
import { getDocument, getWindow } from './globals.js'

export type AudioContextConstructor = {
  new (contextOptions?: AudioContextOptions): AudioContext
}

export type OfflineAudioContextConstructor = {
  new (
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): OfflineAudioContext
}

type WindowWithAudio = Window & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
  OfflineAudioContext?: OfflineAudioContextConstructor
  webkitOfflineAudioContext?: OfflineAudioContextConstructor
}

/** Resolves the standard or prefixed `AudioContext` constructor. */
export function getAudioContextConstructor(): ProbeResult<AudioContextConstructor> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  const w = win.value as WindowWithAudio
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  return runProbe(typeof Ctor === 'function', () => Ctor as AudioContextConstructor)
}

/** Resolves the standard or prefixed `OfflineAudioContext` constructor. */
export function getOfflineAudioContextConstructor(): ProbeResult<OfflineAudioContextConstructor> {
  const win = getWindow()
  if (win.status === 'unsupported') {
    return unsupported()
  }
  if (win.status === 'blocked') {
    return blocked(win.reason, win.error)
  }
  if (win.status === 'error') {
    return probeError(win.error)
  }
  const w = win.value as WindowWithAudio
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext
  return runProbe(typeof Ctor === 'function', () => Ctor as OfflineAudioContextConstructor)
}

export type WebGlProbeOptions = {
  /** Prefer `webgl2` before falling back to `webgl` / `experimental-webgl`. Default true. */
  preferWebGl2?: boolean
}

export type WebGlProbeValue = {
  context: WebGLRenderingContext | WebGL2RenderingContext
  contextId: 'webgl2' | 'webgl' | 'experimental-webgl'
  canvas: HTMLCanvasElement
}

/**
 * Attempts to create a WebGL context on a temporary canvas.
 * Caller **must** invoke {@link releaseWebGlProbe} (or remove the canvas) when finished.
 */
export function probeWebGlContext(options: WebGlProbeOptions = {}): ProbeResult<WebGlProbeValue> {
  const preferWebGl2 = options.preferWebGl2 !== false
  const doc = getDocument()
  if (doc.status === 'unsupported') {
    return unsupported()
  }
  if (doc.status === 'blocked') {
    return blocked(doc.reason, doc.error)
  }
  if (doc.status === 'error') {
    return probeError(doc.error)
  }

  let canvas: HTMLCanvasElement | undefined
  try {
    canvas = doc.value.createElement('canvas')
    if (!canvas || typeof canvas.getContext !== 'function') {
      return unsupported()
    }

    const candidates: Array<'webgl2' | 'webgl' | 'experimental-webgl'> = preferWebGl2
      ? ['webgl2', 'webgl', 'experimental-webgl']
      : ['webgl', 'experimental-webgl', 'webgl2']

    for (const contextId of candidates) {
      const context = canvas.getContext(contextId)
      if (context) {
        return ok({
          context: context as WebGLRenderingContext | WebGL2RenderingContext,
          contextId,
          canvas,
        })
      }
    }
    return unsupported()
  } catch (error) {
    if (canvas?.parentNode) {
      canvas.parentNode.removeChild(canvas)
    }
    if (isBlockedBrowserError(error)) {
      return blocked(error instanceof Error ? error.name : 'blocked', error)
    }
    return probeError(error)
  }
}

/** Releases GL resources and detaches the temporary canvas from the probe result. */
export function releaseWebGlProbe(value: WebGlProbeValue): void {
  const { context, canvas } = value
  const lose = context.getExtension('WEBGL_lose_context')
  if (lose && typeof lose.loseContext === 'function') {
    lose.loseContext()
  }
  if (canvas.parentNode) {
    canvas.parentNode.removeChild(canvas)
  }
  canvas.width = 0
  canvas.height = 0
}
