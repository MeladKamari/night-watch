import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in diagnostics snapshots', () => {
  test('explicit export is local-only, schema-valid, and redacts page context', async ({
    page,
  }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url()
      // Allow only the page document and inlined SDK — block any analytics-like egress.
      if (url.startsWith('http://localhost') || url.startsWith('https://localhost')) {
        await route.continue()
        return
      }
      await route.abort()
    })

    await page.setContent(
      `<!doctype html><html lang="fa" dir="rtl"><head><title>Private Checkout</title></head>
       <body><pre id="out">idle</pre></body></html>`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.addScriptTag({ content: readSdkIife() })

    const report = await page.evaluate(async () => {
      const NightWatch = (
        globalThis as typeof globalThis & {
          NightWatch: {
            load: (o?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
              get: () => Promise<{
                visitorId: string
                components: Record<string, unknown>
              }>
            }>
            loadWithDiagnostics: (o?: {
              delayFallback?: number
              monitoring?: boolean
              diagnostics?: {
                exportedAt?: string
                reproSeed?: string
                includeEnvironment?: boolean
              }
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  components: Record<string, unknown>
                }>
                exportDiagnostics: () => Promise<{
                  snapshot: {
                    schema: string
                    revision: string
                    visitorId: string
                    componentKeys: string[]
                    environment?: Record<string, unknown>
                    reproSeedHash?: string
                  }
                  json: string
                  byteLength: number
                }>
              }
              diagnosticsRevision: string
            }>
            validateDiagnosticSnapshot: (input: unknown) => {
              ok: boolean
              errors?: string[]
            }
            DIAGNOSTICS_SNAPSHOT_SCHEMA: string
            DIAGNOSTICS_REVISION: string
          }
        }
      ).NightWatch

      const networkCalls: string[] = []
      const originalFetch = globalThis.fetch?.bind(globalThis)
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        networkCalls.push(String(args[0]))
        if (originalFetch) return originalFetch(...args)
        throw new Error('fetch blocked in diagnostics e2e')
      }) as typeof fetch

      const beaconCalls: string[] = []
      const nav = navigator as Navigator & { sendBeacon?: typeof navigator.sendBeacon }
      const originalBeacon = nav.sendBeacon?.bind(navigator)
      nav.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
        beaconCalls.push(String(url))
        return originalBeacon ? originalBeacon(url, data) : false
      }) as typeof navigator.sendBeacon

      const full = await (await NightWatch.load({ delayFallback: 0, monitoring: false })).get()

      const { agent, diagnosticsRevision } = await NightWatch.loadWithDiagnostics({
        delayFallback: 0,
        monitoring: false,
        diagnostics: {
          exportedAt: '2026-11-03T00:00:00.000Z',
          reproSeed: 'fa-IR-e2e',
          includeEnvironment: true,
        },
      })

      // Export is explicit — not automatic on load/get.
      const result = await agent.get()
      const exported = await agent.exportDiagnostics()
      const validation = NightWatch.validateDiagnosticSnapshot(exported.snapshot)

      return {
        diagnosticsRevision,
        schema: exported.snapshot.schema,
        revision: NightWatch.DIAGNOSTICS_REVISION,
        expectedSchema: NightWatch.DIAGNOSTICS_SNAPSHOT_SCHEMA,
        fullCount: Object.keys(full.components).length,
        exportKeys: exported.snapshot.componentKeys.length,
        hasApplePay: exported.snapshot.componentKeys.includes('applePay'),
        pageContextRedacted: exported.snapshot.environment?.pageContextRedacted === true,
        hasHref: Object.prototype.hasOwnProperty.call(
          exported.snapshot.environment ?? {},
          'href',
        ),
        hasTitle: Object.prototype.hasOwnProperty.call(
          exported.snapshot.environment ?? {},
          'title',
        ),
        jsonHasPrivateTitle: exported.json.includes('Private Checkout'),
        validationOk: validation.ok,
        visitorIdMatch: exported.snapshot.visitorId === result.visitorId,
        hasReproHash: typeof exported.snapshot.reproSeedHash === 'string',
        networkCalls,
        beaconCalls,
        byteLength: exported.byteLength,
      }
    })

    expect(report.diagnosticsRevision).toBe('night-watch-diagnostics-v1')
    expect(report.schema).toBe(report.expectedSchema)
    expect(report.revision).toBe('night-watch-diagnostics-v1')
    expect(report.fullCount).toBe(41)
    expect(report.exportKeys).toBe(41)
    expect(report.hasApplePay).toBe(false)
    expect(report.pageContextRedacted).toBe(true)
    expect(report.hasHref).toBe(false)
    expect(report.hasTitle).toBe(false)
    expect(report.jsonHasPrivateTitle).toBe(false)
    expect(report.validationOk).toBe(true)
    expect(report.visitorIdMatch).toBe(true)
    expect(report.hasReproHash).toBe(true)
    expect(report.networkCalls).toEqual([])
    expect(report.beaconCalls).toEqual([])
    expect(report.byteLength).toBeGreaterThan(100)
  })
})
