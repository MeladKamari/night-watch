import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { ENABLED_SOURCES, SOURCE_MANIFEST_REVISION } from '@night-watch/core'
import { readSdkIife } from './helpers/inject-sdk.js'
import {
  buildPerfEntropyReport,
  formatPerfEntropyMarkdown,
  measureBundleSizes,
  summarizeCollisions,
  summarizeStability,
  type CollectTimingSample,
  type ModeCompareRow,
} from '../harness/perf/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const sdkDist = join(root, 'packages/browser-sdk/dist')

const MICRO_N = 10
const STABILITY_RELOADS = 20

type PageCollectPayload = {
  wallMs: number
  visitorId: string
  version: string
  sourceDurationsMs: Record<string, number>
  errorKeys: string[]
  nodesBefore: number
  nodesAfter: number
  hasApplePay: boolean
  sourceCount: number
}

async function collectOnce(page: Page, html: string): Promise<PageCollectPayload> {
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  await page.addScriptTag({ content: readSdkIife() })
  return page.evaluate(async () => {
    const consented = (document.getElementById('consent') as HTMLInputElement | null)?.checked
    if (!consented) {
      throw new Error('Consent required')
    }
    const NightWatch = (
      globalThis as typeof globalThis & {
        NightWatch?: {
          load: (opts?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
            get: () => Promise<{
              visitorId: string
              version: string
              components: Record<string, { value?: unknown; error?: unknown; duration: number }>
            }>
          }>
          ENABLED_SOURCE_COUNT: number
        }
      }
    ).NightWatch
    if (!NightWatch?.load) {
      throw new Error('NightWatch missing')
    }

    const nodesBefore = document.getElementsByTagName('*').length
    const t0 = performance.now()
    const agent = await NightWatch.load({ delayFallback: 0, monitoring: false })
    const result = await agent.get()
    const wallMs = performance.now() - t0
    const nodesAfter = document.getElementsByTagName('*').length

    const sourceDurationsMs: Record<string, number> = {}
    const errorKeys: string[] = []
    let hasApplePay = false
    for (const [key, component] of Object.entries(result.components)) {
      if (key === 'applePay') {
        hasApplePay = true
      }
      sourceDurationsMs[key] = component.duration
      if (component && 'error' in component) {
        errorKeys.push(key)
      }
    }

    return {
      wallMs,
      visitorId: result.visitorId,
      version: result.version,
      sourceDurationsMs,
      errorKeys,
      nodesBefore,
      nodesAfter,
      hasApplePay,
      sourceCount: Object.keys(result.components).length,
    }
  })
}

function consentHtml(dir: 'ltr' | 'rtl', lang: string): string {
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <body>
    <main>
      <p>${dir === 'rtl' ? '????? ???? ?? ?????' : 'Local consented sample'}</p>
      <label>
        <input id="consent" type="checkbox" checked />
        I consent to a local-only performance sample (no upload).
      </label>
    </main>
  </body>
</html>`
}

async function visitorIdInContext(
  browser: Browser,
  options: {
    dir: 'ltr' | 'rtl'
    locale?: string
    timezoneId?: string
  },
): Promise<string> {
  const context = await browser.newContext({
    locale: options.locale,
    timezoneId: options.timezoneId,
  })
  try {
    const page = await context.newPage()
    const payload = await collectOnce(page, consentHtml(options.dir, options.locale ?? 'en-US'))
    return payload.visitorId
  } finally {
    await context.close()
  }
}

test.describe('performance / stability / entropy evaluation', () => {
  test('measures timings, 20-reload stability, modes, bundles; writes report', async ({
    page,
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000)

    // --- Microbenchmark (same document, fresh load+get each sample) ---
    const samples: CollectTimingSample[] = []
    let sdkVersion = ''
    let lastDom: { before: number; after: number } | undefined

    for (let i = 0; i < MICRO_N; i++) {
      const payload = await collectOnce(page, consentHtml('ltr', 'en-US'))
      expect(payload.sourceCount).toBe(41)
      expect(payload.hasApplePay).toBe(false)
      expect(payload.visitorId).toMatch(/^[0-9a-f]{32}$/)
      sdkVersion = payload.version
      lastDom = { before: payload.nodesBefore, after: payload.nodesAfter }
      samples.push({
        wallMs: payload.wallMs,
        visitorId: payload.visitorId,
        sourceDurationsMs: payload.sourceDurationsMs,
        errorKeys: payload.errorKeys,
      })
    }

    // --- Stability: 20 full document rebuilds (reload-equivalent) ---
    const reloadIds: string[] = []
    for (let i = 0; i < STABILITY_RELOADS; i++) {
      const payload = await collectOnce(page, consentHtml('ltr', 'en-US'))
      reloadIds.push(payload.visitorId)
    }
    const stabilityReload = summarizeStability('document-rebuild×20', reloadIds, [
      'Each sample is a fresh setContent + IIFE inject + load/get (reload-equivalent profile).',
      'Not a claim of cross-device or post-browser-restart stability.',
    ])

    // --- Mode: LTR vs RTL (direction-only) ---
    const idLtr = await visitorIdInContext(browser, { dir: 'ltr', locale: 'en-US' })
    const idRtl = await visitorIdInContext(browser, {
      dir: 'rtl',
      locale: 'fa-IR',
      timezoneId: 'Asia/Tehran',
    })
    // Direction alone: same browser fingerprint surface may still change with locale/tz —
    // also compare direction-only on identical locale.
    const idRtlEn = await visitorIdInContext(browser, { dir: 'rtl', locale: 'en-US' })

    const modeComparisons: ModeCompareRow[] = [
      {
        modeA: 'ltr+en-US',
        modeB: 'rtl+en-US',
        visitorIdEqual: idLtr === idRtlEn,
        visitorIdA: idLtr,
        visitorIdB: idRtlEn,
        notes: [
          'Same locale/timezone; only html dir differs — visitorId must not change solely due to RTL.',
        ],
      },
      {
        modeA: 'ltr+en-US',
        modeB: 'rtl+fa-IR+Asia/Tehran',
        visitorIdEqual: idLtr === idRtl,
        visitorIdA: idLtr,
        visitorIdB: idRtl,
        notes: [
          'Locale/timezone fixtures may legitimately change languages/timezone sources; not an RTL defect.',
        ],
      },
    ]

    // --- Independent ephemeral context (incognito-like) ---
    const idDefault = samples[0]!.visitorId
    const incognito = await browser.newContext()
    let idIncognito = ''
    try {
      const p = await incognito.newPage()
      idIncognito = (await collectOnce(p, consentHtml('ltr', 'en-US'))).visitorId
    } finally {
      await incognito.close()
    }
    modeComparisons.push({
      modeA: 'default-context',
      modeB: 'ephemeral-context',
      visitorIdEqual: idDefault === idIncognito,
      visitorIdA: idDefault,
      visitorIdB: idIncognito,
      notes: [
        'Same engine/profile class; storage isolation should not alter default-profile visitorId when signals are environment-stable.',
      ],
    })

    // --- Collision cohort: same-profile repeats (expect uniqueness ratio ~1/n if stable) ---
    const sameProfileCollision = summarizeCollisions('same-profile micro+reloads', [
      ...samples.map((s) => s.visitorId),
      ...reloadIds,
    ], [
      'Local Playwright Chromium cohort only; not a worldwide collision rate.',
    ])

    // Diversified synthetic cohort (locale/tz variants) — still consented lab fixtures.
    const diversifiedIds = [
      idLtr,
      idRtlEn,
      idRtl,
      idIncognito,
      ...(
        await Promise.all([
          visitorIdInContext(browser, { dir: 'ltr', locale: 'en-US', timezoneId: 'UTC' }),
          visitorIdInContext(browser, {
            dir: 'ltr',
            locale: 'en-US',
            timezoneId: 'Europe/Berlin',
          }),
        ])
      ),
    ]
    const diversifiedCollision = summarizeCollisions(
      'lab locale/timezone variants',
      diversifiedIds,
      [
        'Synthetic lab diversity (locale/tz). Numerators/denominators only — no uniqueness claim.',
      ],
    )

    const bundleSizes = measureBundleSizes(sdkDist)
    expect(bundleSizes.some((b) => b.path === 'fp.min.js')).toBe(true)

    const viewport = page.viewportSize() ?? undefined
    const report = buildPerfEntropyReport({
      consented: true,
      samples,
      sdkVersion,
      environment: {
        userAgent: await page.evaluate(() => navigator.userAgent),
        browserName,
        headless: true,
        locale: 'en-US',
        timezoneId: '(default)',
        viewport: viewport
          ? { width: viewport.width, height: viewport.height }
          : { width: 0, height: 0 },
        deviceClass: 'desktop-playwright',
      },
      stability: [stabilityReload],
      modeComparisons,
      collisions: [sameProfileCollision, diversifiedCollision],
      bundleSizes,
      domCleanup: lastDom
        ? {
            nodesBefore: lastDom.before,
            nodesAfter: lastDom.after,
            delta: lastDom.after - lastDom.before,
            notes: [
              'Node count includes consent DOM; collectors should not leave unbounded detached trees.',
              'WebGL cache / AudioContext close are source-owned (disposeWebGlCache / closeAudioContext).',
            ],
          }
        : undefined,
      operationalNotes: [
        `Wall-clock sample size=${MICRO_N}; delayFallback=0 (idle scheduling skipped for microbench).`,
        `Stability rebuilds=${STABILITY_RELOADS}.`,
        `Enabled sources locked at ${ENABLED_SOURCES.length} (${SOURCE_MANIFEST_REVISION}); applePay absent.`,
        'Budgets are observed baselines (p50/p95/p99), not invented absolute SLAs.',
        'No network egress expected; scripts are self-hosted IIFE only.',
      ],
      notRun: [
        'Real mid-range / low-memory Chrome for Android hardware (CPU/memory) — emulator/device required',
        'Real Android System WebView / Samsung Internet / iOS Safari hardware',
        'Browser restart persistence across OS sessions',
        'Main-thread long-task attribution via PerformanceObserver in production pages',
        'Multi-thousand consented production entropy dataset',
      ],
    })

    const outDir = join(root, 'reference')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      join(outDir, 'perf-entropy-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    )
    writeFileSync(join(outDir, 'perf-entropy-report.md'), formatPerfEntropyMarkdown(report))

    // Hard gates (honest, non-invented)
    expect(report.consented).toBe(true)
    expect(report.wallClock.sampleSize).toBe(MICRO_N)
    expect(report.algorithm.enabledSourceCount).toBe(41)
    expect(report.sourceCosts).toHaveLength(41)
    expect(report.sourceCosts.every((r) => r.key !== 'applePay')).toBe(true)
    expect(stabilityReload.visitorIds).toHaveLength(STABILITY_RELOADS)
    // Same-profile rebuilds should be stable in this headless lab (report share; require majority).
    expect(stabilityReload.majorityShare).toBe(1)
    // RTL direction alone must not change visitorId.
    expect(idLtr).toBe(idRtlEn)
    expect(report.bundleSizes.length).toBeGreaterThan(0)
    expect(report.notRun.length).toBeGreaterThan(0)

    testInfo.annotations.push({
      type: 'perf-p50-ms',
      description: String(report.wallClock.p50),
    })
    testInfo.annotations.push({
      type: 'perf-p95-ms',
      description: String(report.wallClock.p95),
    })
  })

  test('CPU-throttled mobile viewport sample is recorded (emulated; not real device)', async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CDP CPU throttle is Chromium-only')

    const context = await browser.newContext({
      ...{
        viewport: { width: 393, height: 851 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    })
    const page = await context.newPage()
    const client = await context.newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    const payload = await collectOnce(page, consentHtml('ltr', 'en-US'))
    await context.close()

    expect(payload.sourceCount).toBe(41)
    expect(payload.hasApplePay).toBe(false)
    expect(payload.visitorId).toMatch(/^[0-9a-f]{32}$/)
    // Emulated evidence only — real mid-end Android remains NOT RUN in the report.
    expect(payload.wallMs).toBeGreaterThan(0)
  })
})
