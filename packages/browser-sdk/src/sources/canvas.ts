import {
  getDocument,
  isBrowserEnvironment,
  isGecko,
  isGecko120OrNewer,
  isSafariWebKit,
  isWebKit,
  isWebKit616OrNewer,
  type BuiltinSourceOptions,
  type Source,
} from '@night-watch/core'

export type CanvasFingerprint = {
  winding: boolean
  geometry: string
  text: string
}

/** Image / data-URL status tokens used when a stable PNG cannot be produced. */
export const ImageStatus = {
  Unsupported: 'unsupported',
  Skipped: 'skipped',
  Unstable: 'unstable',
} as const

export type ImageStatusCode = (typeof ImageStatus)[keyof typeof ImageStatus]

/**
 * Canonical canvas text (Latin + smiling emoji via surrogates).
 * Locked to FingerprintJS OSS v5.3.0 — Persian/RTL must not alter this hashed fixture (D-022).
 */
export const CANVAS_PRINTED_TEXT = `Cwm fjordbank gly ${String.fromCharCode(55357, 56835)}`

export type CanvasFingerprintOptions = {
  /** Force skip of geometry/text images (tests / antifingerprinting). */
  skipImages?: boolean
  /** Inject document for createElement (tests). */
  document?: Document
}

/**
 * Stabilized canvas fingerprint: skips images on Safari 17+ / Firefox 120+
 * (private-mode / ETP canvas noise).
 */
export function getCanvasFingerprint(options: CanvasFingerprintOptions = {}): CanvasFingerprint {
  const skip =
    options.skipImages === true ||
    (options.skipImages !== false && doesBrowserPerformAntiFingerprinting())
  return getUnstableCanvasFingerprint(skip, options)
}

/**
 * Unstable canvas fingerprint (no antifingerprinting skip unless `skipImages` is set).
 */
export function getUnstableCanvasFingerprint(
  skipImages = false,
  options: CanvasFingerprintOptions = {},
): CanvasFingerprint {
  let winding = false
  let geometry: string
  let text: string

  const [canvas, context] = makeCanvasContext(options.document)
  if (!canvas || !context || !canvas.toDataURL) {
    geometry = text = ImageStatus.Unsupported
  } else {
    winding = doesSupportWinding(context)
    if (skipImages) {
      geometry = text = ImageStatus.Skipped
    } else {
      ;[geometry, text] = renderImages(canvas, context)
    }
  }

  return { winding, geometry, text }
}

function makeCanvasContext(
  doc?: Document,
): readonly [HTMLCanvasElement | null, CanvasRenderingContext2D | null] {
  let documentRef = doc
  if (!documentRef) {
    if (!isBrowserEnvironment()) {
      return [null, null]
    }
    const probe = getDocument()
    if (probe.status !== 'ok') {
      return [null, null]
    }
    documentRef = probe.value
  }

  try {
    const canvas = documentRef.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return [canvas, canvas.getContext('2d')]
  } catch {
    return [null, null]
  }
}

export function doesSupportWinding(context: CanvasRenderingContext2D): boolean {
  context.rect(0, 0, 10, 10)
  context.rect(2, 2, 6, 6)
  return !context.isPointInPath(5, 5, 'evenodd')
}

function renderImages(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): [geometry: string, text: string] {
  renderTextImage(canvas, context)
  let textImage1: string
  let textImage2: string
  try {
    textImage1 = canvasToString(canvas)
    textImage2 = canvasToString(canvas)
  } catch {
    return [ImageStatus.Unsupported, ImageStatus.Unsupported]
  }

  if (textImage1 !== textImage2) {
    return [ImageStatus.Unstable, ImageStatus.Unstable]
  }

  renderGeometryImage(canvas, context)
  let geometryImage: string
  try {
    geometryImage = canvasToString(canvas)
  } catch {
    return [ImageStatus.Unsupported, textImage1]
  }
  return [geometryImage, textImage1]
}

export function renderTextImage(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  canvas.width = 240
  canvas.height = 60

  context.textBaseline = 'alphabetic'
  context.fillStyle = '#f60'
  context.fillRect(100, 1, 62, 20)

  context.fillStyle = '#069'
  context.font = '11pt "Times New Roman"'
  context.fillText(CANVAS_PRINTED_TEXT, 2, 15)
  context.fillStyle = 'rgba(102, 204, 0, 0.2)'
  context.font = '18pt Arial'
  context.fillText(CANVAS_PRINTED_TEXT, 4, 45)
}

export function renderGeometryImage(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void {
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
}

function canvasToString(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL()
}

/** Safari 17+ and Firefox 120+ may noise canvas in private / strict modes. */
export function doesBrowserPerformAntiFingerprinting(): boolean {
  const isSafari17OrAbove = isWebKit() && isWebKit616OrNewer() && isSafariWebKit()
  const isFirefox120OrAbove = isGecko() && isGecko120OrNewer()
  return isSafari17OrAbove || isFirefox120OrAbove
}

export const getCanvas: Source<BuiltinSourceOptions, CanvasFingerprint> = () =>
  getCanvasFingerprint()
