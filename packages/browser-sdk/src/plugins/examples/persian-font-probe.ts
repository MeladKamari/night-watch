import { getDocument, type ProbeResult } from '@night-watch/core'
import type { PluginDefinition } from '../types.js'

/**
 * Example opt-in plugin: probes a small set of Persian/Arabic display fonts.
 * Does **not** alter the 41-source default-profile registry or default `load()` IDs.
 * Register only via {@link import('../load-with-plugins.js').loadWithPlugins}.
 *
 * Locales / font names are test compatibility inputs — not nationality signals.
 */
export type PersianFontProbeResult = {
  readonly available: readonly string[]
  readonly probed: readonly string[]
  readonly document: 'ok' | 'unsupported'
}

const DEFAULT_CANDIDATES = [
  'Tahoma',
  'Arial',
  'IranSans',
  'Vazirmatn',
  'Noto Naskh Arabic',
] as const

export type PersianFontProbeOptions = {
  readonly candidates?: readonly string[]
  /** Override document probe (tests). */
  readonly documentProbe?: () => ProbeResult<Document>
}

/**
 * Factory for the sample Persian/Arabic font availability plugin (`ext:persianFontProbe`).
 */
export function createPersianFontProbePlugin(
  options: PersianFontProbeOptions = {},
): PluginDefinition<PersianFontProbeResult> {
  const candidates = [...(options.candidates ?? DEFAULT_CANDIDATES)]
  const documentProbe = options.documentProbe ?? getDocument

  return {
    id: 'night-watch-example-persian-font-probe',
    key: 'ext:persianFontProbe',
    version: '1.0.0',
    timeoutMs: 1500,
    jsonSafe: true,
    collect: () => {
      const docProbe = documentProbe()
      if (docProbe.status !== 'ok') {
        return {
          available: [],
          probed: candidates,
          document: 'unsupported',
        }
      }

      const document = docProbe.value
      const body = document.body
      if (!body) {
        return {
          available: [],
          probed: candidates,
          document: 'ok',
        }
      }

      const probe = document.createElement('span')
      probe.style.cssText =
        'position:absolute;left:-9999px;top:0;font-size:72px;visibility:hidden;white-space:nowrap'
      probe.textContent = 'ابپثش'
      body.appendChild(probe)

      try {
        probe.style.fontFamily = 'monospace'
        const baseWidth = probe.offsetWidth
        const available: string[] = []
        for (const font of candidates) {
          probe.style.fontFamily = `"${font}", monospace`
          if (probe.offsetWidth !== baseWidth) {
            available.push(font)
          }
        }
        return {
          available,
          probed: candidates,
          document: 'ok',
        }
      } finally {
        probe.remove()
      }
    },
  }
}
