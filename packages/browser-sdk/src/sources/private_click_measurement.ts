import { getDocument, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * Anchor surface used for Safari Private Click Measurement (PCM) detection.
 * WebKit may expose camelCase and/or lowercase attribute-style properties.
 */
export type AnchorWithAttribution = {
  readonly attributionSourceId?: unknown
  readonly attributionsourceid?: unknown
}

/** Minimal document surface: create an unattached `<a>` only. */
export type DocumentWithCreateAnchor = {
  createElement(tagName: 'a'): AnchorWithAttribution
}

export type PrivateClickMeasurementOptions = {
  /** Inject document for `createElement('a')` (skips live `getDocument`). */
  document?: DocumentWithCreateAnchor | null
  /** Inject a pre-built anchor-like object (skips document entirely). */
  link?: AnchorWithAttribution | null
}

/**
 * Reads Safari PCM / privacy-preserving ad attribution presence from an
 * unattached `<a>` element's `attributionSourceId` / `attributionsourceid`.
 *
 * - Property absent → `undefined` (Chromium, Firefox, mobile Safari typically).
 * - Present (including `''` / `0`) → `String(value)` (desktop Safari with PCM on).
 * - Does **not** append to the DOM, navigate, click, or register attribution.
 * - Makes **no** network requests.
 *
 * @see https://webkit.org/blog/11529/introducing-private-click-measurement-pcm/
 */
export function getPrivateClickMeasurementValue(
  options: PrivateClickMeasurementOptions = {},
): string | undefined {
  if ('link' in options) {
    if (options.link == null) {
      return undefined
    }
    return readPrivateClickMeasurement(options.link)
  }
  if ('document' in options) {
    if (options.document == null) {
      return undefined
    }
    return probePrivateClickMeasurement(options.document)
  }
  const docProbe = getDocument()
  if (docProbe.status !== 'ok') {
    return undefined
  }
  return probePrivateClickMeasurement(docProbe.value as DocumentWithCreateAnchor)
}

/**
 * Creates an unattached `<a>` and reads attribution source id properties.
 * Never appends, clicks, or sets `href` for navigation.
 */
export function probePrivateClickMeasurement(
  documentLike: DocumentWithCreateAnchor | null | undefined,
): string | undefined {
  if (documentLike == null) {
    return undefined
  }
  const link = documentLike.createElement('a')
  return readPrivateClickMeasurement(link)
}

/**
 * Maps anchor attribution properties to optional string (upstream semantics).
 * `undefined` stays unsupported; any other value (incl. `null`, `0`, `''`) → `String(...)`.
 */
export function readPrivateClickMeasurement(
  link: AnchorWithAttribution | null | undefined,
): string | undefined {
  if (link == null) {
    return undefined
  }
  const sourceId = link.attributionSourceId ?? link.attributionsourceid
  return sourceId === undefined ? undefined : String(sourceId)
}

/** Entropy source: Safari Private Click Measurement feature state (optional string). */
export const getPrivateClickMeasurement: Source<BuiltinSourceOptions, string | undefined> = () =>
  getPrivateClickMeasurementValue()
