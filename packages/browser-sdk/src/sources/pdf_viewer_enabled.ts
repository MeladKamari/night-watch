import { getNavigator, type BuiltinSourceOptions, type Source } from '@night-watch/core'

/**
 * `navigator.pdfViewerEnabled` surface (Chromium ≥94, Firefox ≥99, Safari ≥16.4).
 * Absent on older engines → `undefined` (not coerced to `false`).
 */
export type NavigatorWithPdfViewerEnabled = {
  readonly pdfViewerEnabled?: boolean
}

export type PdfViewerEnabledOptions = {
  /** Inject navigator-like object for tests (skips live `getNavigator`). */
  navigator?: NavigatorWithPdfViewerEnabled | null
}

/**
 * Reads `navigator.pdfViewerEnabled` when present.
 * Does **not** open PDFs or touch plugin MIME lists.
 * Absence / Node → `undefined` — never invent `false` for unsupported.
 */
export function getPdfViewerEnabledValue(
  options: PdfViewerEnabledOptions = {},
): boolean | undefined {
  if ('navigator' in options) {
    return readPdfViewerEnabled(options.navigator)
  }
  const navProbe = getNavigator()
  if (navProbe.status !== 'ok') {
    return undefined
  }
  return readPdfViewerEnabled(navProbe.value as NavigatorWithPdfViewerEnabled)
}

export function readPdfViewerEnabled(
  navigatorLike: NavigatorWithPdfViewerEnabled | null | undefined,
): boolean | undefined {
  if (navigatorLike == null) {
    return undefined
  }
  return navigatorLike.pdfViewerEnabled
}

/** Entropy source: built-in PDF viewer availability flag. */
export const getPdfViewerEnabled: Source<BuiltinSourceOptions, boolean | undefined> = () =>
  getPdfViewerEnabledValue()
