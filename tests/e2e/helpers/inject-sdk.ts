import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

const iifePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/browser-sdk/dist/fp.min.js',
)

let cachedIife: string | undefined

/** Reads the self-hosted IIFE once (first-party; no CDN). */
export function readSdkIife(): string {
  if (cachedIife === undefined) {
    cachedIife = readFileSync(iifePath, 'utf8')
  }
  return cachedIife
}

export type ComponentArm = {
  kind: 'value' | 'error'
  summary: string
}

export type CollectSummary = {
  visitorId: string
  version: string
  sourceCount: number
  enabledSourceCount: number
  hasApplePay: boolean
  errorKeys: string[]
  timezone: ComponentArm
  languages: ComponentArm
  webGlBasics: ComponentArm
  audio: ComponentArm
  sessionStorage: ComponentArm
  localStorage: ComponentArm
}

type PageIbf = {
  load: (opts?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
    get: () => Promise<{
      visitorId: string
      version: string
      components: Record<string, { value?: unknown; error?: unknown; duration: number }>
    }>
  }>
  ENABLED_SOURCES: string[]
  ENABLED_SOURCE_COUNT: number
}

/**
 * Injects the published IIFE via a classic script element (self-hosted; no CDN).
 * Then runs one `load()` + `get()` with monitoring forced off.
 */
export async function injectSdkAndCollect(
  page: Page,
  options: { delayFallbackMs?: number } = {},
): Promise<CollectSummary> {
  await page.addScriptTag({ content: readSdkIife() })
  const delayFallback = options.delayFallbackMs ?? 0

  return page.evaluate(async (delay) => {
    const NightWatch = (globalThis as typeof globalThis & { NightWatch?: PageIbf }).NightWatch
    if (!NightWatch || typeof NightWatch.load !== 'function') {
      throw new Error('NightWatch global missing after script injection')
    }
    const agent = await NightWatch.load({ delayFallback: delay, monitoring: false })
    const result = await agent.get()
    const components = result.components

    const arm = (key: string): ComponentArm => {
      const component = components[key]
      if (!component) {
        return { kind: 'error', summary: 'missing' }
      }
      if ('error' in component) {
        const err = component.error
        if (err instanceof Error) {
          return { kind: 'error', summary: `${err.name}: ${err.message}` }
        }
        return { kind: 'error', summary: String(err) }
      }
      try {
        return { kind: 'value', summary: JSON.stringify(component.value).slice(0, 160) }
      } catch {
        return { kind: 'value', summary: String(component.value) }
      }
    }

    const errorKeys: string[] = []
    for (const key of Object.keys(components)) {
      const component = components[key]
      if (component && 'error' in component) {
        errorKeys.push(key)
      }
    }

    return {
      visitorId: result.visitorId,
      version: result.version,
      sourceCount: Object.keys(components).length,
      enabledSourceCount: NightWatch.ENABLED_SOURCE_COUNT,
      hasApplePay:
        Object.prototype.hasOwnProperty.call(components, 'applePay') ||
        NightWatch.ENABLED_SOURCES.includes('applePay'),
      errorKeys,
      timezone: arm('timezone'),
      languages: arm('languages'),
      webGlBasics: arm('webGlBasics'),
      audio: arm('audio'),
      sessionStorage: arm('sessionStorage'),
      localStorage: arm('localStorage'),
    }
  }, delayFallback)
}

/** Escapes a script body for safe embedding inside an HTML `<script>` tag. */
export function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script')
}
