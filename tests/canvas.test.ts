import {
  CANVAS_PRINTED_TEXT,
  ImageStatus,
  componentsToCanonicalString,
  createBuiltinSources,
  getUnstableCanvasFingerprint,
  hashComponents,
  isValueComponent,
  load,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

type CtxMocks = {
  getContextResult?: CanvasRenderingContext2D | null
  toDataURL?: () => string
  toDataURLSequence?: string[]
  throwOnCreate?: boolean
}

function createCanvasDocument(mocks: CtxMocks = {}): Document {
  let toDataCall = 0
  return {
    createElement(tag: string) {
      if (tag !== 'canvas') {
        throw new Error(`unexpected ${tag}`)
      }
      if (mocks.throwOnCreate) {
        throw new Error('blocked')
      }
      const canvas = {
        width: 1,
        height: 1,
        toDataURL:
          mocks.toDataURL ??
          (() => {
            if (mocks.toDataURLSequence) {
              const v = mocks.toDataURLSequence[toDataCall] ?? mocks.toDataURLSequence.at(-1)!
              toDataCall += 1
              return v
            }
            return 'data:image/png;base64,AAA'
          }),
        getContext(id: string) {
          if (id !== '2d') {
            return null
          }
          if (mocks.getContextResult === null) {
            return null
          }
          if (mocks.getContextResult) {
            return mocks.getContextResult
          }
          return {
            rect() {},
            isPointInPath: () => false,
            textBaseline: '',
            fillStyle: '',
            font: '',
            fillRect() {},
            fillText() {},
            globalCompositeOperation: '',
            beginPath() {},
            arc() {},
            closePath() {},
            fill() {},
          } as unknown as CanvasRenderingContext2D
        },
      }
      return canvas as unknown as HTMLCanvasElement
    },
  } as unknown as Document
}

describe('CANVAS_PRINTED_TEXT', () => {
  it('locks upstream Latin+emoji fixture (no Persian substitution)', () => {
    expect(CANVAS_PRINTED_TEXT.startsWith('Cwm fjordbank gly ')).toBe(true)
    expect(CANVAS_PRINTED_TEXT).toContain(String.fromCharCode(55357, 56835))
    expect(CANVAS_PRINTED_TEXT).not.toMatch(/[\u0600-\u06FF]/)
  })
})

describe('getUnstableCanvasFingerprint', () => {
  it('returns unsupported when canvas/context unavailable', () => {
    expect(
      getUnstableCanvasFingerprint(false, {
        document: createCanvasDocument({ getContextResult: null }),
      }),
    ).toEqual({
      winding: false,
      geometry: ImageStatus.Unsupported,
      text: ImageStatus.Unsupported,
    })
  })

  it('returns unsupported when createElement is blocked', () => {
    expect(
      getUnstableCanvasFingerprint(false, {
        document: createCanvasDocument({ throwOnCreate: true }),
      }),
    ).toEqual({
      winding: false,
      geometry: ImageStatus.Unsupported,
      text: ImageStatus.Unsupported,
    })
  })

  it('returns skipped images when antifingerprinting skip is set', () => {
    const result = getUnstableCanvasFingerprint(true, {
      document: createCanvasDocument({}),
    })
    expect(result.geometry).toBe(ImageStatus.Skipped)
    expect(result.text).toBe(ImageStatus.Skipped)
    expect(typeof result.winding).toBe('boolean')
  })

  it('returns unstable when consecutive toDataURL differ', () => {
    expect(
      getUnstableCanvasFingerprint(false, {
        document: createCanvasDocument({
          toDataURLSequence: ['data:a', 'data:b'],
        }),
      }),
    ).toEqual({
      winding: true,
      geometry: ImageStatus.Unstable,
      text: ImageStatus.Unstable,
    })
  })

  it('returns stable geometry and text data URLs when encoding is stable', () => {
    const result = getUnstableCanvasFingerprint(false, {
      document: createCanvasDocument({
        toDataURLSequence: ['data:image/png;base64,TEXT', 'data:image/png;base64,TEXT', 'data:image/png;base64,GEO'],
      }),
    })
    expect(result.text).toBe('data:image/png;base64,TEXT')
    expect(result.geometry).toBe('data:image/png;base64,GEO')
    expect(result.winding).toBe(true)
  })

  it('treats toDataURL throw as unsupported', () => {
    expect(
      getUnstableCanvasFingerprint(false, {
        document: createCanvasDocument({
          toDataURL: () => {
            throw new Error('security')
          },
        }),
      }),
    ).toEqual({
      winding: true,
      geometry: ImageStatus.Unsupported,
      text: ImageStatus.Unsupported,
    })
  })
})

describe('builtin canvas wiring', () => {
  it('wires canvas as source #7; Node yields unsupported images', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[6]).toBe('canvas')
    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.canvas)).toBe(true)
    if (isValueComponent(result.components.canvas)) {
      expect(result.components.canvas.value).toEqual({
        winding: false,
        geometry: ImageStatus.Unsupported,
        text: ImageStatus.Unsupported,
      })
    }
    expect(
      componentsToCanonicalString({
        canvas: {
          value: { winding: true, geometry: 'g', text: 't' },
          duration: 1,
        },
      }),
    ).toContain('canvas:')
    expect(
      hashComponents({
        canvas: {
          value: { winding: true, geometry: ImageStatus.Skipped, text: ImageStatus.Skipped },
          duration: 1,
        },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
