import { chromium } from '@playwright/test'

const API = 'http://127.0.0.1:5080'

async function collectProbes(page) {
  return page.evaluate(() => {
    const win = window
    const doc = document
    const ua = navigator.userAgent || ''
    const navigatorWebdriver = typeof navigator.webdriver === 'boolean' ? navigator.webdriver : null
    const headlessUa = /HeadlessChrome|chromium-headless-shell/i.test(ua)
    const brands =
      navigator.userAgentData?.brands?.map((b) => `${b.brand};v=${b.version ?? ''}`) ?? []
    let cdpSideEffect = false
    try {
      const err = new Error()
      Object.defineProperty(err, 'stack', {
        configurable: true,
        get() {
          cdpSideEffect = true
          return ''
        },
      })
      console.debug(err)
    } catch {
      /* ignore */
    }
    const checks = [
      ['navigator.webdriver', () => navigator.webdriver === true],
      ['window.__playwright__binding__', () => '__playwright__binding__' in win],
      ['window.__pwInitScripts', () => '__pwInitScripts' in win],
      ['window.__playwright', () => '__playwright' in win],
      ['window.__puppeteer_evaluation_script__', () => '__puppeteer_evaluation_script__' in win],
    ]
    const automationArtifacts = []
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
      'browseruse',
      'headlesschrome',
      'playwright',
      'agentic',
    ]) {
      if (uaLower.includes(m)) automationArtifacts.push('ua:' + m)
    }
    if (cdpSideEffect) automationArtifacts.push('cdp.side_effect')
    return {
      probeCollected: true,
      userAgent: ua,
      navigatorWebdriver,
      headlessUa,
      cdpSideEffect,
      clientHintBrands: brands,
      automationArtifacts: [...new Set(automationArtifacts)],
    }
  })
}

async function evaluate(label, { userAgent, headers } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(userAgent ? { userAgent } : {})
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
  const probes = await collectProbes(page)
  const body = {
    tenantId: 'tenant_demo',
    businessAction: 'checkout',
    eventId: 'ev_ai_precise_' + Date.now() + Math.random().toString(16).slice(2, 6),
    nonce: 'n_' + Math.random().toString(16).slice(2),
    suspectScore: 0,
    userAgent: probes.userAgent,
    environmentProbes: probes,
  }
  const res = await fetch(`${API}/v1/decisions/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'tenant_demo',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  const want = [
    'ai_agent_detection',
    'browser_automation_agent_detection',
    'browser_bot_detection',
  ]
  const contrib = (json.scoreReceipt?.contributions || [])
    .filter((c) => want.includes(c.signalId))
    .map((c) => ({ id: c.signalId, tri: c.triState, pts: c.appliedPoints, reason: c.reasonCode }))
  await browser.close()
  return { label, probes, score: json.scoreReceipt?.usedScore, action: json.action, contrib }
}

const cases = [
  await evaluate('playwright_stock'),
  await evaluate('openai_operator_ua', {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 openai-operator',
  }),
  await evaluate('chatgpt_signature_agent', {
    headers: { 'Signature-Agent': '"https://chatgpt.com"' },
  }),
]

console.log(JSON.stringify(cases, null, 2))
