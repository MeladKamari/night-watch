import { compareSnapshots, type RunComparison } from './compare.js'
import { copyTextToClipboard } from './clipboard.js'
import { collectFingerprint } from './collect.js'
import { formatDualNumber, toPersianDigits } from './format.js'
import { collectEnvironmentProbes } from './environment-probes.js'
import {
  evaluateDecision,
  identifyToProPlus,
  pingApi,
  readLabConfig,
  type IdentifyLabResult,
} from './proplus-lab.js'
import {
  snapshotFromResult,
  snapshotToCopyJson,
  type PlaygroundSnapshot,
} from './snapshot.js'

export type PlaygroundController = {
  readonly destroy: () => void
}

type UiState = {
  consented: boolean
  busy: boolean
  current: PlaygroundSnapshot | undefined
  previous: PlaygroundSnapshot | undefined
  identify: IdentifyLabResult | undefined
  status: string
  statusTone: 'info' | 'ok' | 'error'
}

/**
 * Mounts the interactive LTR diagnostics UI.
 * Must be called after DOM is available (never at module top level).
 */
export function mountPlayground(root: HTMLElement): PlaygroundController {
  const state: UiState = {
    consented: false,
    busy: false,
    current: undefined,
    previous: undefined,
    identify: undefined,
    status: 'Consent required before local collection.',
    statusTone: 'info',
  }

  root.innerHTML = shellHtml()
  const els = bindElements(root)
  const cfg = readLabConfig()
  els.apiBase.textContent = cfg.apiBase

  const onConsent = () => {
    state.consented = els.consent.checked
    syncControls()
    if (state.consented) {
      setStatus('Ready. Local collect first; Pro+ send is opt-in via lab buttons.', 'info')
    } else {
      setStatus('Consent required before local collection.', 'info')
    }
  }

  const onCollect = () => {
    void runCollection()
  }

  const onCopy = () => {
    void copyCurrentJson()
  }

  const onPing = () => {
    void runPing()
  }

  const onIdentify = () => {
    void runIdentify()
  }

  const onDecide = () => {
    void runDecision()
  }

  const onProbe = () => {
    renderProbes(collectEnvironmentProbes())
    setStatus('Environment probe refreshed (observed only — nothing simulated).', 'ok')
  }

  const onKeyActivate = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  els.consent.addEventListener('change', onConsent)
  els.collect.addEventListener('click', onCollect)
  els.copy.addEventListener('click', onCopy)
  els.ping.addEventListener('click', onPing)
  els.identify.addEventListener('click', onIdentify)
  els.decide.addEventListener('click', onDecide)
  els.probe.addEventListener('click', onProbe)
  els.collect.addEventListener('keydown', (event) => onKeyActivate(event, onCollect))
  els.copy.addEventListener('keydown', (event) => onKeyActivate(event, onCopy))

  syncControls()
  renderAll()
  void runPing()
  renderProbes(collectEnvironmentProbes())

  return {
    destroy() {
      els.consent.removeEventListener('change', onConsent)
      els.collect.removeEventListener('click', onCollect)
      els.copy.removeEventListener('click', onCopy)
      els.ping.removeEventListener('click', onPing)
      els.identify.removeEventListener('click', onIdentify)
      els.decide.removeEventListener('click', onDecide)
      els.probe.removeEventListener('click', onProbe)
      root.innerHTML = ''
    },
  }

  function setStatus(message: string, tone: UiState['statusTone']): void {
    state.status = message
    state.statusTone = tone
    els.status.textContent = message
    els.status.dataset.tone = tone
  }

  function syncControls(): void {
    const canRun = state.consented && !state.busy
    els.collect.disabled = !canRun
    els.copy.disabled = !state.current || state.busy
    els.identify.disabled = !state.current || state.busy
    els.decide.disabled = state.busy
    els.ping.disabled = state.busy
    els.probe.disabled = state.busy
    els.collect.setAttribute('aria-disabled', String(!canRun))
    els.copy.setAttribute('aria-disabled', String(!state.current || state.busy))
    els.busy.hidden = !state.busy
  }

  function renderProbes(probes: ReturnType<typeof collectEnvironmentProbes>): void {
    els.probeWebdriver.textContent =
      probes.navigatorWebdriver === null ? 'n/a' : String(probes.navigatorWebdriver)
    els.probeHeadless.textContent = String(probes.headlessUa)
    els.probeArtifacts.textContent =
      probes.automationArtifacts.length === 0
        ? '(none observed)'
        : probes.automationArtifacts.join(', ')
  }

  async function runPing(): Promise<void> {
    const ping = await pingApi()
    els.apiHealth.textContent = ping.ok ? 'live' : `down — ${ping.body}`
    els.apiHealth.dataset.tone = ping.ok ? 'ok' : 'error'
  }

  async function runIdentify(): Promise<void> {
    if (!state.current || state.busy) {
      return
    }
    state.busy = true
    syncControls()
    setStatus('POST /v1/identify …', 'info')
    try {
      const keys = state.current.signals.map((s) => s.key)
      const probes = collectEnvironmentProbes()
      renderProbes(probes)
      const nav = globalThis.navigator
      const result = await identifyToProPlus({
        legacyVisitorId: state.current.visitorId,
        componentKeys: keys,
        sourceManifestRevision: state.current.sourceManifestRevision,
        clientDevice: {
          platform: nav?.platform,
          osFamily: nav?.platform,
          browserFamily: nav?.userAgent,
          locale: nav?.language,
          screenWidth: globalThis.screen?.width,
          screenHeight: globalThis.screen?.height,
        },
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
          platform: probes.platform ?? undefined,
          deviceMemory: probes.deviceMemory ?? undefined,
          hardwareConcurrency: probes.hardwareConcurrency ?? undefined,
          maxTouchPoints: probes.maxTouchPoints ?? undefined,
          colorDepth: probes.colorDepth ?? undefined,
          webGlVendor: probes.webGlVendor ?? undefined,
          webGlRenderer: probes.webGlRenderer ?? undefined,
          incognitoSuspected: probes.incognitoSuspected ?? undefined,
          vmSuspected: probes.vmSuspected ?? undefined,
        },
      })
      state.identify = result
      els.proVisitor.textContent = result.visitorId
      els.proEvent.textContent = result.eventId
      els.proMatch.textContent = result.matchType
      els.proJson.textContent = JSON.stringify(result.raw, null, 2)
      setStatus(`Identify OK — ${result.matchType} · event ${result.eventId}`, 'ok')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Identify failed: ${message}`, 'error')
      els.errorBanner.hidden = false
      els.errorBanner.textContent = message
    } finally {
      state.busy = false
      syncControls()
    }
  }

  async function runDecision(): Promise<void> {
    if (state.busy) {
      return
    }
    state.busy = true
    syncControls()
    setStatus('POST /v1/decisions/evaluate (real probes) …', 'info')
    try {
      const probes = collectEnvironmentProbes()
      renderProbes(probes)
      const eventId =
        state.identify?.eventId ||
        `evt_local_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
      const result = await evaluateDecision({
        eventId,
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
          platform: probes.platform ?? undefined,
          deviceMemory: probes.deviceMemory ?? undefined,
          hardwareConcurrency: probes.hardwareConcurrency ?? undefined,
          maxTouchPoints: probes.maxTouchPoints ?? undefined,
          colorDepth: probes.colorDepth ?? undefined,
          webGlVendor: probes.webGlVendor ?? undefined,
          webGlRenderer: probes.webGlRenderer ?? undefined,
          incognitoSuspected: probes.incognitoSuspected ?? undefined,
          vmSuspected: probes.vmSuspected ?? undefined,
        },
      })
      els.proAction.textContent = result.action
      els.proScore.textContent =
        result.usedScore != null ? String(result.usedScore) : result.score != null ? String(result.score) : '—'
      els.proJson.textContent = JSON.stringify(result.raw, null, 2)
      setStatus(`Decision: ${result.action} (score ${els.proScore.textContent}) · observed probes only`, 'ok')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Decision failed: ${message}`, 'error')
      els.errorBanner.hidden = false
      els.errorBanner.textContent = message
    } finally {
      state.busy = false
      syncControls()
    }
  }

  async function runCollection(): Promise<void> {
    if (!state.consented || state.busy) {
      return
    }
    state.busy = true
    els.errorBanner.hidden = true
    els.errorBanner.textContent = ''
    syncControls()
    setStatus('Collecting locally…', 'info')
    try {
      // Fresh load()+get() each click — independent of prior agent instances.
      const fresh = await collectFingerprint()
      const snapshot = snapshotFromResult(fresh)
      if (state.current) {
        state.previous = state.current
      }
      state.current = snapshot
      setStatus(
        state.previous
          ? 'Independent repeat run complete. Comparison updated.'
          : 'Collection complete. Results are local only.',
        'ok',
      )
      renderAll()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Collection failed: ${message}`, 'error')
      els.errorBanner.hidden = false
      els.errorBanner.textContent = message
    } finally {
      state.busy = false
      syncControls()
    }
  }

  async function copyCurrentJson(): Promise<void> {
    if (!state.current) {
      return
    }
    try {
      const payload = snapshotToCopyJson(state.current)
      const via = await copyTextToClipboard(payload)
      setStatus(`Copied JSON via ${via} (user action only — no upload).`, 'ok')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Copy failed: ${message}`, 'error')
    }
  }

  function renderAll(): void {
    renderSummary(state.current)
    renderTable(state.current)
    renderUnsupported(state.current)
    renderCompare(state.previous, state.current)
  }

  function renderSummary(snapshot: PlaygroundSnapshot | undefined): void {
    if (!snapshot) {
      els.visitorId.textContent = '—'
      els.visitorIdPersian.textContent = ''
      els.confidence.textContent = '—'
      els.confidenceDual.textContent = ''
      els.version.textContent = '—'
      els.collectedAt.textContent = '—'
      els.comment.textContent = ''
      return
    }
    els.visitorId.textContent = snapshot.visitorId
    // Persian digits are display-only; hashed id remains Latin hex above.
    els.visitorIdPersian.textContent = `نمایش ارقام فارسی (فقط UI): ${toPersianDigits(snapshot.visitorId)}`
    const score = formatDualNumber(snapshot.confidenceScore, 2)
    els.confidence.textContent = score.latin
    els.confidenceDual.textContent = `(${score.persian})`
    els.version.textContent = snapshot.version
    els.collectedAt.textContent = snapshot.collectedAtIso
    els.comment.textContent = snapshot.confidenceComment ?? ''
  }

  function renderTable(snapshot: PlaygroundSnapshot | undefined): void {
    const body = els.tableBody
    body.replaceChildren()
    if (!snapshot) {
      const empty = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 4
      td.textContent = 'No run yet.'
      empty.appendChild(td)
      body.appendChild(empty)
      return
    }
    for (const row of snapshot.signals) {
      const tr = document.createElement('tr')
      tr.dataset.kind = row.kind
      const dualDuration = formatDualNumber(row.durationMs, 1)
      tr.append(
        cell(row.key),
        cell(row.kind, row.kind === 'error' ? 'kind-error' : 'kind-value'),
        cell(row.summary),
        cell(`${dualDuration.latin} ms (${dualDuration.persian})`, 'num'),
      )
      body.appendChild(tr)
    }
  }

  function renderUnsupported(snapshot: PlaygroundSnapshot | undefined): void {
    const list = els.unsupportedList
    list.replaceChildren()
    if (!snapshot || snapshot.errorKeys.length === 0) {
      const li = document.createElement('li')
      li.textContent =
        snapshot == null
          ? 'Run a consented collection to list error / unsupported sources.'
          : 'No error-arm components in this run.'
      list.appendChild(li)
      return
    }
    for (const key of snapshot.errorKeys) {
      const li = document.createElement('li')
      const signal = snapshot.signals.find((row) => row.key === key)
      li.textContent = signal ? `${key} — ${signal.summary}` : key
      list.appendChild(li)
    }
  }

  function renderCompare(
    previous: PlaygroundSnapshot | undefined,
    current: PlaygroundSnapshot | undefined,
  ): void {
    if (!previous || !current) {
      els.comparePanel.hidden = true
      els.compareBody.textContent = 'Run twice to compare independent collections.'
      return
    }
    els.comparePanel.hidden = false
    const diff = compareSnapshots(previous, current)
    els.compareBody.replaceChildren()
    els.compareBody.appendChild(compareFragment(diff, previous, current))
  }
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td')
  td.textContent = text
  if (className) {
    td.className = className
  }
  return td
}

function compareFragment(
  diff: RunComparison,
  previous: PlaygroundSnapshot,
  current: PlaygroundSnapshot,
): DocumentFragment {
  const frag = document.createDocumentFragment()
  const dl = document.createElement('dl')
  dl.className = 'compare-dl'
  appendDl(dl, 'Previous visitorId', previous.visitorId)
  appendDl(dl, 'Current visitorId', current.visitorId)
  appendDl(dl, 'visitorId changed', diff.visitorIdChanged ? 'yes' : 'no')
  appendDl(dl, 'Changed keys', diff.changedKeys.join(', ') || '(none)')
  appendDl(dl, 'Only in previous', diff.onlyInPrevious.join(', ') || '(none)')
  appendDl(dl, 'Only in current', diff.onlyInCurrent.join(', ') || '(none)')
  appendDl(dl, 'Confidence Δ', formatDualNumber(diff.confidenceScoreDelta, 3).latin)
  frag.appendChild(dl)
  return frag
}

function appendDl(dl: HTMLDListElement, term: string, value: string): void {
  const dt = document.createElement('dt')
  dt.textContent = term
  const dd = document.createElement('dd')
  dd.textContent = value
  dl.append(dt, dd)
}

type Bound = {
  consent: HTMLInputElement
  collect: HTMLButtonElement
  copy: HTMLButtonElement
  ping: HTMLButtonElement
  identify: HTMLButtonElement
  decide: HTMLButtonElement
  probe: HTMLButtonElement
  status: HTMLElement
  busy: HTMLElement
  visitorId: HTMLElement
  visitorIdPersian: HTMLElement
  confidence: HTMLElement
  confidenceDual: HTMLElement
  version: HTMLElement
  collectedAt: HTMLElement
  comment: HTMLElement
  tableBody: HTMLElement
  unsupportedList: HTMLElement
  comparePanel: HTMLElement
  compareBody: HTMLElement
  errorBanner: HTMLElement
  apiBase: HTMLElement
  apiHealth: HTMLElement
  proVisitor: HTMLElement
  proEvent: HTMLElement
  proMatch: HTMLElement
  proAction: HTMLElement
  proScore: HTMLElement
  proJson: HTMLElement
  probeWebdriver: HTMLElement
  probeHeadless: HTMLElement
  probeArtifacts: HTMLElement
}

function bindElements(root: HTMLElement): Bound {
  const need = <T extends HTMLElement>(selector: string): T => {
    const el = root.querySelector(selector)
    if (!el) {
      throw new Error(`Missing playground element: ${selector}`)
    }
    return el as T
  }
  return {
    consent: need<HTMLInputElement>('#consent'),
    collect: need<HTMLButtonElement>('#collect'),
    copy: need<HTMLButtonElement>('#copy-json'),
    ping: need<HTMLButtonElement>('#pro-ping'),
    identify: need<HTMLButtonElement>('#pro-identify'),
    decide: need<HTMLButtonElement>('#pro-decide'),
    probe: need<HTMLButtonElement>('#pro-probe'),
    status: need('#status'),
    busy: need('#busy'),
    visitorId: need('#visitor-id'),
    visitorIdPersian: need('#visitor-id-fa'),
    confidence: need('#confidence-score'),
    confidenceDual: need('#confidence-score-fa'),
    version: need('#sdk-version'),
    collectedAt: need('#collected-at'),
    comment: need('#confidence-comment'),
    tableBody: need('#signals-body'),
    unsupportedList: need('#unsupported-list'),
    comparePanel: need('#compare-panel'),
    compareBody: need('#compare-body'),
    errorBanner: need('#error-banner'),
    apiBase: need('#pro-api-base'),
    apiHealth: need('#pro-api-health'),
    proVisitor: need('#pro-visitor'),
    proEvent: need('#pro-event'),
    proMatch: need('#pro-match'),
    proAction: need('#pro-action'),
    proScore: need('#pro-score'),
    proJson: need('#pro-json'),
    probeWebdriver: need('#probe-webdriver'),
    probeHeadless: need('#probe-headless'),
    probeArtifacts: need('#probe-artifacts'),
  }
}

function shellHtml(): string {
  return `
    <div class="diag-toolbar">
      <label class="consent" for="consent">
        <input id="consent" type="checkbox" />
        <span>
          I consent to a developer diagnostic run on this browser (local collect + optional Pro+ lab API).
          This does <strong>not</strong> reveal IP address, nationality, or a physical device identity.
        </span>
      </label>
      <div class="actions" role="group" aria-label="Collection actions">
        <button type="button" id="collect" class="btn primary" disabled>Collect / Run again</button>
        <button type="button" id="copy-json" class="btn" disabled>Copy JSON</button>
      </div>
      <p id="status" class="status" role="status" aria-live="polite" data-tone="info"></p>
      <p id="busy" class="busy" hidden>Working…</p>
      <p id="error-banner" class="error-banner" role="alert" hidden></p>
    </div>

    <section class="proplus-lab" aria-label="Pro+ API lab">
      <h3>Pro+ API lab (loopback)</h3>
      <p class="note">
        API: <code id="pro-api-base">—</code> · health:
        <strong id="pro-api-health" data-tone="info">checking…</strong>
      </p>
      <div class="actions" role="group" aria-label="Pro+ lab actions">
        <button type="button" id="pro-ping" class="btn">Ping API</button>
        <button type="button" id="pro-probe" class="btn">Refresh env probes</button>
        <button type="button" id="pro-identify" class="btn primary" disabled>1 · Identify → API</button>
        <button type="button" id="pro-decide" class="btn" disabled>2 · Evaluate decision</button>
      </div>
      <p class="note">
        AI / automation / remote signals use <strong>observed</strong> browser probes only
        (navigator.webdriver, runtime artifacts, real UA markers). No simulated toggles.
      </p>
      <dl class="summary-dl">
        <dt>navigator.webdriver</dt>
        <dd id="probe-webdriver">—</dd>
        <dt>HeadlessChrome UA</dt>
        <dd id="probe-headless">—</dd>
        <dt>artifacts</dt>
        <dd id="probe-artifacts">—</dd>
        <dt>server visitorId</dt>
        <dd><code id="pro-visitor">—</code></dd>
        <dt>eventId</dt>
        <dd><code id="pro-event">—</code></dd>
        <dt>matchType</dt>
        <dd id="pro-match">—</dd>
        <dt>decision</dt>
        <dd id="pro-action">—</dd>
        <dt>score</dt>
        <dd id="pro-score">—</dd>
      </dl>
      <pre id="pro-json" class="pro-json" aria-label="Last Pro+ JSON">{}</pre>
    </section>

    <section class="summary" aria-label="Run summary">
      <h3>Current run</h3>
      <dl class="summary-dl">
        <dt>visitorId</dt>
        <dd><code id="visitor-id">—</code></dd>
        <dt class="sr-only">visitorId Persian digits (display only)</dt>
        <dd id="visitor-id-fa" class="fa-note" lang="fa" dir="rtl"></dd>
        <dt>confidence</dt>
        <dd><span id="confidence-score">—</span> <span id="confidence-score-fa" class="fa-note"></span></dd>
        <dt>version</dt>
        <dd id="sdk-version">—</dd>
        <dt>collected at</dt>
        <dd id="collected-at">—</dd>
      </dl>
      <p id="confidence-comment" class="comment"></p>
    </section>

    <section class="signals" aria-label="Signal table">
      <h3>Signals (value / error / duration)</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Kind</th>
              <th scope="col">Value or error</th>
              <th scope="col">Duration</th>
            </tr>
          </thead>
          <tbody id="signals-body"></tbody>
        </table>
      </div>
    </section>

    <section class="unsupported" aria-label="Error and unsupported sources">
      <h3>Error / unsupported sources</h3>
      <p class="note">
        Listed keys failed or are unavailable in this environment. Absence is not proof of
        nationality, IP, or a specific physical device.
      </p>
      <ul id="unsupported-list"></ul>
    </section>

    <section id="compare-panel" class="compare" aria-label="Repeat-run comparison" hidden>
      <h3>Independent repeat-run comparison</h3>
      <div id="compare-body"></div>
    </section>
  `
}
