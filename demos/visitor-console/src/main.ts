import { SDK_PACKAGE_VERSION } from '@thenightwatch/browser-sdk'
import {
  createNightWatchClient,
  ENABLED_SOURCE_COUNT,
  VANILLA_PACKAGE_VERSION,
} from '@thenightwatch/vanilla'

const identifyBtn = document.querySelector<HTMLButtonElement>('#identify')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!
const resultEl = document.querySelector<HTMLElement>('#result')!
const visitorEl = document.querySelector<HTMLElement>('#visitor-id')!
const metaEl = document.querySelector<HTMLDListElement>('#meta')!
const statusEl = document.querySelector<HTMLElement>('#status')!

const client = createNightWatchClient({
  monitoring: false,
  delayFallback: 0,
})

function setStatus(text: string, tone: 'ok' | 'error' | 'busy' = 'ok'): void {
  statusEl.textContent = text
  statusEl.dataset.tone = tone === 'error' ? 'error' : ''
}

function renderMeta(visitorId: string, version: string | null, ms: number): void {
  metaEl.innerHTML = `
    <dt>SDK</dt><dd>@thenightwatch/browser-sdk@${SDK_PACKAGE_VERSION}</dd>
    <dt>Vanilla</dt><dd>@thenightwatch/vanilla@${VANILLA_PACKAGE_VERSION}</dd>
    <dt>Agent</dt><dd>${version ?? '—'}</dd>
    <dt>Sources</dt><dd>${ENABLED_SOURCE_COUNT} default collectors</dd>
    <dt>Latency</dt><dd>${ms.toFixed(0)} ms</dd>
    <dt>Stable</dt><dd>${visitorId.slice(0, 8)}…${visitorId.slice(-6)}</dd>
  `
}

async function runIdentify(): Promise<void> {
  identifyBtn.disabled = true
  againBtn.disabled = true
  setStatus('Collecting browser signals…', 'busy')

  const started = performance.now()
  try {
    const result = await client.identify(true)
    const ms = performance.now() - started
    visitorEl.textContent = result.visitorId
    renderMeta(result.visitorId, result.version, ms)
    resultEl.hidden = false
    againBtn.hidden = false
    setStatus('Ready — same browser should keep a stable visitor id.')
  } catch (err) {
    resultEl.hidden = true
    setStatus(err instanceof Error ? err.message : String(err), 'error')
  } finally {
    identifyBtn.disabled = false
    againBtn.disabled = false
  }
}

identifyBtn.addEventListener('click', () => {
  void runIdentify()
})
againBtn.addEventListener('click', () => {
  void runIdentify()
})

setStatus('Click Identify to run Night Watch against this browser.')
