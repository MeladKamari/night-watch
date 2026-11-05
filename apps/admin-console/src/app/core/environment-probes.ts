/**
 * Observed browser environment probes only — never invent or simulate markers.
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
}

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
    // eslint-disable-next-line no-console
    console.debug(err)
  } catch {
    return false
  }
  return triggered
}

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

  const uaData = (nav as Navigator & {
    userAgentData?: { brands?: Array<{ brand: string; version: string }> }
  }).userAgentData
  const clientHintBrands =
    uaData?.brands?.map((b) => `${b.brand};v=${b.version ?? ''}`).filter(Boolean) ?? []
  const headlessClientHint = clientHintBrands.some((b) => /HeadlessChrome|Headless/i.test(b))
  const cdpSideEffect = detectCdpSideEffect()

  let chromeRuntimeMissing: boolean | null = null
  try {
    const chrome = win.chrome as { runtime?: unknown } | undefined
    if (chrome && typeof chrome === 'object') {
      chromeRuntimeMissing = !('runtime' in chrome) || chrome.runtime == null
    } else if (/Chrome\//i.test(ua) && !/Firefox|Edg\//i.test(ua)) {
      chromeRuntimeMissing = true
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

  const checks: Array<[string, () => boolean]> = [
    ['navigator.webdriver', () => (nav as Navigator & { webdriver?: boolean }).webdriver === true],
    ['window.__playwright__binding__', () => '__playwright__binding__' in win],
    ['window.__pwInitScripts', () => '__pwInitScripts' in win],
    ['window.playwright', () => 'playwright' in win && win.playwright != null],
    ['window.__playwright', () => '__playwright' in win],
    ['window.__pw_manual', () => '__pw_manual' in win],
    ['window.__puppeteer_evaluation_script__', () => '__puppeteer_evaluation_script__' in win],
    ['window.callPhantom', () => 'callPhantom' in win || '_phantom' in win],
    ['window.__selenium_unwrapped', () => '__selenium_unwrapped' in win || '_Selenium_IDE_Recorder' in win],
    ['window.domAutomation', () => 'domAutomation' in win || 'domAutomationController' in win],
    [
      'document.$cdc_',
      () =>
        Object.getOwnPropertyNames(doc).some(
          (k) => k.startsWith('$cdc_') || k.startsWith('$chrome_asyncScriptInfo'),
        ),
    ],
  ]

  const automationArtifacts: string[] = []
  for (const [id, present] of checks) {
    try {
      if (present()) automationArtifacts.push(id)
    } catch {
      /* ignore */
    }
  }

  const uaLower = ua.toLowerCase()
  for (const m of [
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
    'teamviewer',
    'anydesk',
  ]) {
    if (uaLower.includes(m)) automationArtifacts.push('ua:' + m)
  }
  for (const brand of clientHintBrands) {
    if (/HeadlessChrome|Headless/i.test(brand)) automationArtifacts.push('ch-ua:' + brand)
  }
  if (cdpSideEffect) automationArtifacts.push('cdp.side_effect')
  if (chromeRuntimeMissing === true) automationArtifacts.push('chrome.runtime_missing')

  const evidence = [...new Set(automationArtifacts)]
  if (navigatorWebdriver === true && !evidence.includes('navigator.webdriver')) {
    evidence.push('navigator.webdriver')
  }
  if (headlessUa) evidence.push('headless_ua')
  if (headlessClientHint) evidence.push('headless_client_hint')

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
    evidence,
  }
}

export function probesToApiPayload(probes: EnvironmentProbeReport): Record<string, unknown> {
  return {
    environmentProbes: {
      probeCollected: true,
      userAgent: probes.userAgent,
      navigatorWebdriver: probes.navigatorWebdriver,
      headlessUa: probes.headlessUa || probes.headlessClientHint,
      cdpSideEffect: probes.cdpSideEffect,
      chromeRuntimeMissing: probes.chromeRuntimeMissing,
      pluginCount: probes.pluginCount,
      clientHintBrands: probes.clientHintBrands,
      automationArtifacts: probes.automationArtifacts,
    },
    userAgent: probes.userAgent,
  }
}
