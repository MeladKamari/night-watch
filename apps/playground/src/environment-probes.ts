/**
 * Observed browser environment probes only — never invent or simulate markers.
 * Each artifact is reported only when actually present in this runtime.
 */

export type EnvironmentProbeReport = {
  probeCollected: true
  collectedAt: string
  userAgent: string
  navigatorWebdriver: boolean | null
  headlessUa: boolean
  headlessClientHint: boolean
  cdpSideEffect: boolean
  chromeRuntimeMissing: boolean | null
  pluginCount: number | null
  clientHintBrands: string[]
  automationArtifacts: string[]
  evidence: string[]
  platform: string | null
  deviceMemory: number | null
  hardwareConcurrency: number | null
  maxTouchPoints: number | null
  colorDepth: number | null
  webGlVendor: string | null
  webGlRenderer: string | null
  incognitoSuspected: boolean | null
  vmSuspected: boolean | null
}

type ArtifactProbe = {
  id: string
  present: () => boolean
}

function safePresent(fn: () => boolean): boolean {
  try {
    return fn() === true
  } catch {
    return false
  }
}

function readClientHintBrands(nav: Navigator): string[] {
  const brands: string[] = []
  const uaData = (nav as Navigator & {
    userAgentData?: { brands?: Array<{ brand: string; version: string }> }
  }).userAgentData
  if (!uaData?.brands) return brands
  for (const b of uaData.brands) {
    if (b?.brand) brands.push(`${b.brand};v=${b.version ?? ''}`)
  }
  return brands
}

/**
 * CDP (Chrome DevTools Protocol) side-effect probe used by Playwright/Puppeteer.
 * Only reports true when the getter is actually invoked by a debugger/CDP serializer.
 */
function detectCdpSideEffect(): boolean {
  let triggered = false
  try {
    const err = new Error()
    Object.defineProperty(err, 'stack', {
      configurable: true,
      get() {
        triggered = true
        return ''
      },
    })
    // console.debug is observed by CDP and forces stack access when attached.
    // eslint-disable-next-line no-console
    console.debug(err)
  } catch {
    return false
  }
  return triggered
}

function buildArtifactProbes(win: Window & Record<string, unknown>, doc: Document): ArtifactProbe[] {
  return [
    {
      id: 'navigator.webdriver',
      present: () => (win.navigator as Navigator & { webdriver?: boolean }).webdriver === true,
    },
    {
      id: 'window.__playwright__binding__',
      present: () => '__playwright__binding__' in win,
    },
    {
      id: 'window.__pwInitScripts',
      present: () => '__pwInitScripts' in win,
    },
    {
      id: 'window.playwright',
      present: () => 'playwright' in win && win.playwright != null,
    },
    {
      id: 'window.__playwright',
      present: () => '__playwright' in win,
    },
    {
      id: 'window.__pw_manual',
      present: () => '__pw_manual' in win,
    },
    {
      id: 'window.__PW_inspect',
      present: () => '__PW_inspect' in win,
    },
    {
      id: 'window.__puppeteer_evaluation_script__',
      present: () => '__puppeteer_evaluation_script__' in win,
    },
    {
      id: 'window.callPhantom',
      present: () => 'callPhantom' in win || '_phantom' in win,
    },
    {
      id: 'window.__selenium_unwrapped',
      present: () => '__selenium_unwrapped' in win || '_Selenium_IDE_Recorder' in win,
    },
    {
      id: 'window.domAutomation',
      present: () => 'domAutomation' in win || 'domAutomationController' in win,
    },
    {
      id: 'document.$cdc_',
      present: () =>
        Object.getOwnPropertyNames(doc).some(
          (k) => k.startsWith('$cdc_') || k.startsWith('$chrome_asyncScriptInfo'),
        ),
    },
    {
      id: 'document.documentElement.webdriver',
      present: () => doc.documentElement?.getAttribute('webdriver') === 'true',
    },
  ]
}

const UA_MARKERS = [
  'openai-operator',
  'chatgpt-user',
  'chatgpt',
  'browseruse',
  'browserbase',
  'playwright',
  'puppeteer',
  'selenium',
  'headlesschrome',
  'chromium-headless-shell',
  'agentic',
  'computer-use',
  'anthropic',
  'claude-web',
  'perplexity',
  'teamviewer',
  'anydesk',
] as const

/**
 * Collect only what is present. Empty artifacts = nothing suspicious observed.
 */
export function collectEnvironmentProbes(
  globalObj: Window & typeof globalThis = window,
): EnvironmentProbeReport {
  const win = globalObj as unknown as Window & Record<string, unknown>
  const doc = win.document
  const nav = win.navigator
  const ua = typeof nav?.userAgent === 'string' ? nav.userAgent : ''
  const webdriverRaw = (nav as Navigator & { webdriver?: boolean })?.webdriver
  const navigatorWebdriver = typeof webdriverRaw === 'boolean' ? webdriverRaw : null
  const headlessUa = /HeadlessChrome|chromium-headless-shell/i.test(ua)
  const clientHintBrands = readClientHintBrands(nav)
  const headlessClientHint = clientHintBrands.some((b) => /HeadlessChrome|Headless/i.test(b))
  const cdpSideEffect = detectCdpSideEffect()

  let chromeRuntimeMissing: boolean | null = null
  try {
    const chrome = win.chrome as { runtime?: unknown } | undefined
    if (chrome && typeof chrome === 'object') {
      chromeRuntimeMissing = !('runtime' in chrome) || chrome.runtime == null
    } else if (/Chrome\//i.test(ua) && !/Firefox|Edg\//i.test(ua)) {
      // Chromium UA without chrome object is an automation tell.
      chromeRuntimeMissing = true
    } else {
      chromeRuntimeMissing = null
    }
  } catch {
    chromeRuntimeMissing = null
  }

  let pluginCount: number | null = null
  try {
    pluginCount = nav.plugins ? nav.plugins.length : null
  } catch {
    pluginCount = null
  }

  const automationArtifacts: string[] = []
  for (const probe of buildArtifactProbes(win, doc)) {
    if (safePresent(probe.present)) {
      automationArtifacts.push(probe.id)
    }
  }

  const uaLower = ua.toLowerCase()
  for (const m of UA_MARKERS) {
    if (uaLower.includes(m)) {
      automationArtifacts.push('ua:' + m)
    }
  }
  for (const brand of clientHintBrands) {
    if (/HeadlessChrome|Headless/i.test(brand)) {
      automationArtifacts.push('ch-ua:' + brand)
    }
  }
  if (cdpSideEffect) {
    automationArtifacts.push('cdp.side_effect')
  }
  if (chromeRuntimeMissing === true) {
    automationArtifacts.push('chrome.runtime_missing')
  }

  const evidence = [...automationArtifacts]
  if (navigatorWebdriver === true && !evidence.includes('navigator.webdriver')) {
    evidence.push('navigator.webdriver')
  }
  if (headlessUa) evidence.push('headless_ua')
  if (headlessClientHint) evidence.push('headless_client_hint')

  let webGlVendor: string | null = null
  let webGlRenderer: string | null = null
  try {
    const canvas = doc.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl && 'getExtension' in gl) {
      const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info') as {
        UNMASKED_VENDOR_WEBGL: number
        UNMASKED_RENDERER_WEBGL: number
      } | null
      if (dbg) {
        webGlVendor = (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string
        webGlRenderer = (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string
      }
    }
  } catch {
    webGlVendor = null
    webGlRenderer = null
  }

  const vmBlob = `${webGlVendor ?? ''}|${webGlRenderer ?? ''}`.toLowerCase()
  const vmSuspected = vmBlob.length > 1
    ? /swiftshader|llvmpipe|virtualbox|vmware|qemu|hyper-v|parallels/.test(vmBlob)
    : null

  let incognitoSuspected: boolean | null = null
  try {
    const est = (nav as Navigator & { storage?: { estimate?: () => Promise<{ quota?: number }> } }).storage
    if (est?.estimate) {
      // Chrome private mode often reports a tiny quota; only mark when observed.
      // We cannot await here synchronously — leave null unless TemporaryStorage probe via sync API exists.
      incognitoSuspected = null
    }
  } catch {
    incognitoSuspected = null
  }

  const navExt = nav as Navigator & { deviceMemory?: number; hardwareConcurrency?: number; maxTouchPoints?: number }
  return {
    probeCollected: true,
    collectedAt: new Date().toISOString(),
    userAgent: ua,
    navigatorWebdriver,
    headlessUa,
    headlessClientHint,
    cdpSideEffect,
    chromeRuntimeMissing,
    pluginCount,
    clientHintBrands,
    automationArtifacts: [...new Set(automationArtifacts)],
    evidence: [...new Set(evidence)],
    platform: typeof nav?.platform === 'string' ? nav.platform : null,
    deviceMemory: typeof navExt.deviceMemory === 'number' ? navExt.deviceMemory : null,
    hardwareConcurrency: typeof navExt.hardwareConcurrency === 'number' ? navExt.hardwareConcurrency : null,
    maxTouchPoints: typeof navExt.maxTouchPoints === 'number' ? navExt.maxTouchPoints : null,
    colorDepth: typeof globalObj.screen?.colorDepth === 'number' ? globalObj.screen.colorDepth : null,
    webGlVendor,
    webGlRenderer,
    incognitoSuspected,
    vmSuspected,
  }
}
