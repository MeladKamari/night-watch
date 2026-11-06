import { identify, type GetResult, type LoadAgentOptions } from '@thenightwatch/vanilla'

/** JSON-safe subset returned to .NET via JS interop. */
export type BlazorIdentifyResult = {
  visitorId: string
  version: string
  confidenceScore: number | null
  confidenceComment: string | null
}

function toBlazorResult(result: GetResult): BlazorIdentifyResult {
  const score =
    typeof result.confidence?.score === 'number' ? result.confidence.score : null
  const comment =
    typeof result.confidence?.comment === 'string' ? result.confidence.comment : null
  return {
    visitorId: result.visitorId,
    version: result.version,
    confidenceScore: score,
    confidenceComment: comment,
  }
}

/**
 * Blazor-callable identify. Keep the exported name stable for `[JSImport]` / `IJSRuntime`.
 * Accepts a JSON string (from .NET) or a plain options object (JS / tests).
 */
export async function identifyForBlazor(
  optionsOrJson?: string | LoadAgentOptions | null,
): Promise<BlazorIdentifyResult> {
  let options: LoadAgentOptions = { monitoring: false }
  if (typeof optionsOrJson === 'string' && optionsOrJson.trim().length > 0) {
    try {
      options = { monitoring: false, ...(JSON.parse(optionsOrJson) as LoadAgentOptions) }
    } catch {
      options = { monitoring: false }
    }
  } else if (optionsOrJson && typeof optionsOrJson === 'object') {
    options = { monitoring: false, ...optionsOrJson }
  }
  const result = await identify(options)
  return toBlazorResult(result)
}

declare global {
  interface Window {
    NightWatchBlazor?: {
      identify: typeof identifyForBlazor
    }
  }
}

/** Attach helpers on `window.NightWatchBlazor` for classic Blazor script tags. */
export function installNightWatchBlazorGlobal(): void {
  if (typeof window === 'undefined') return
  window.NightWatchBlazor = { identify: identifyForBlazor }
}
