import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in fingerprint change inspector', () => {
  test('diffs two local gets with stable order, disclaimer, and no applePay', async ({
    page,
  }) => {
    await page.setContent(
      `<!doctype html><html lang="fa" dir="rtl"><body><pre id="out">idle</pre></body></html>`,
    )
    await page.addScriptTag({ content: readSdkIife() })

    const report = await page.evaluate(async () => {
      const NightWatch = (
        globalThis as typeof globalThis & {
          NightWatch: {
            load: (o?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
              get: () => Promise<{
                visitorId: string
                components: Record<string, { value?: unknown; error?: unknown; duration: number }>
              }>
            }>
            inspectFingerprintChange: (
              a: unknown,
              b: unknown,
            ) => {
              revision: string
              disclaimer: string
              visitorIdChanged: boolean
              comparedSourceCount: number
              changedSourceCount: number
              changes: Array<{
                source: string
                kind: string
                expectedInstability: string
                hint: string
              }>
              rows: Array<{ source: string }>
            }
            formatFingerprintChangeReport: (r: unknown) => string
            inspectFingerprintRebuild: (o?: {
              delayFallback?: number
              monitoring?: boolean
            }) => Promise<{
              report: { disclaimer: string; visitorIdChanged: boolean }
              formatted: string
            }>
            CHANGE_INSPECTOR_REVISION: string
            CHANGE_INSPECTOR_DISCLAIMER: string
          }
        }
      ).NightWatch

      const networkCalls: string[] = []
      const originalFetch = globalThis.fetch?.bind(globalThis)
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        networkCalls.push(String(args[0]))
        if (originalFetch) return originalFetch(...args)
        throw new Error('unexpected fetch')
      }) as typeof fetch

      const agent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const first = await agent.get()
      // Clone components and force a canvas value change (volatile tier).
      const secondComponents: Record<
        string,
        { value?: unknown; error?: unknown; duration: number }
      > = {}
      for (const key of Object.keys(first.components)) {
        secondComponents[key] = { ...first.components[key]! }
      }
      secondComponents.canvas = {
        value: { geometry: 'changed-for-inspector', text: 'probe', winding: true },
        duration: (first.components.canvas?.duration ?? 0) + 1,
      }
      const second = {
        visitorId: 'ffffffffffffffffffffffffffffffff',
        components: secondComponents,
      }

      const diff = NightWatch.inspectFingerprintChange(first, second)
      const formatted = NightWatch.formatFingerprintChangeReport(diff)
      const rebuild = await NightWatch.inspectFingerprintRebuild({
        delayFallback: 0,
        monitoring: false,
      })

      const changeSources = diff.changes.map((c) => c.source)
      return {
        revision: diff.revision,
        expectedRevision: NightWatch.CHANGE_INSPECTOR_REVISION,
        disclaimer: diff.disclaimer,
        expectedDisclaimer: NightWatch.CHANGE_INSPECTOR_DISCLAIMER,
        visitorIdChanged: diff.visitorIdChanged,
        compared: diff.comparedSourceCount,
        changed: diff.changedSourceCount,
        changeSources,
        sortedChanges: [...changeSources].sort(),
        hasApplePay: diff.rows.some((r) => r.source === 'applePay'),
        canvasKind: diff.changes.find((c) => c.source === 'canvas')?.kind,
        canvasInstability: diff.changes.find((c) => c.source === 'canvas')?.expectedInstability,
        formattedHasDisclaimer: formatted.includes(NightWatch.CHANGE_INSPECTOR_DISCLAIMER),
        rebuildDisclaimer: rebuild.report.disclaimer,
        networkCalls,
        fullCount: Object.keys(first.components).length,
      }
    })

    expect(report.revision).toBe(report.expectedRevision)
    expect(report.disclaimer).toBe(report.expectedDisclaimer)
    expect(report.disclaimer.toLowerCase()).toContain('probabilistic')
    expect(report.visitorIdChanged).toBe(true)
    expect(report.compared).toBe(41)
    expect(report.changed).toBeGreaterThan(0)
    expect(report.changeSources).toEqual(report.sortedChanges)
    expect(report.hasApplePay).toBe(false)
    expect(report.canvasKind).toBe('value_changed')
    expect(report.canvasInstability).toBe('volatile')
    expect(report.formattedHasDisclaimer).toBe(true)
    expect(report.rebuildDisclaimer).toBe(report.expectedDisclaimer)
    expect(report.networkCalls).toEqual([])
    expect(report.fullCount).toBe(41)
  })
})
