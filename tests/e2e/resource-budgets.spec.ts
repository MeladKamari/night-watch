import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in resource budgets', () => {
  test('abort during collection yields error components; iframes cleaned; default load untouched', async ({
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
                components: Record<string, unknown>
              }>
            }>
            loadWithResourceBudget: (o: {
              delayFallback?: number
              monitoring?: boolean
              budget: {
                signal?: AbortSignal
                totalTimeoutMs?: number
                perSourceTimeoutMs?: number
              }
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  components: Record<
                    string,
                    { value?: unknown; error?: { name?: string }; duration?: number }
                  >
                }>
              }
              resolution: {
                manifest: { revision: string }
                mayAlterVisitorIdOnTimeoutOrAbort: boolean
              }
              dispose: () => void
              getPendingTimerCount: () => number
            }>
            RESOURCE_BUDGETS_REVISION: string
          }
        }
      ).NightWatch

      const fullAgent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const full = await fullAgent.get()

      const controller = new AbortController()
      const { agent, resolution, getPendingTimerCount, dispose } =
        await NightWatch.loadWithResourceBudget({
          delayFallback: 0,
          monitoring: false,
          budget: {
            signal: controller.signal,
            perSourceTimeoutMs: 10_000,
          },
        })

      const getPromise = agent.get()
      controller.abort()
      const aborted = await getPromise

      const errorKeys = Object.keys(aborted.components).filter((key) => {
        const component = aborted.components[key]
        return component != null && 'error' in component
      })

      const pendingAfter = getPendingTimerCount()
      dispose()

      return {
        revision: NightWatch.RESOURCE_BUDGETS_REVISION,
        fullCount: Object.keys(full.components).length,
        fullHasApplePay: Object.prototype.hasOwnProperty.call(full.components, 'applePay'),
        fullId: full.visitorId,
        abortedId: aborted.visitorId,
        mayAlter: resolution.mayAlterVisitorIdOnTimeoutOrAbort,
        errorKeys,
        pendingAfter,
        iframeCount: document.querySelectorAll('iframe').length,
      }
    })

    expect(report.revision).toBe('night-watch-resource-budgets-v1')
    expect(report.fullCount).toBe(41)
    expect(report.fullHasApplePay).toBe(false)
    expect(report.mayAlter).toBe(true)
    expect(report.abortedId).not.toBe(report.fullId)
    expect(report.errorKeys.length).toBeGreaterThan(0)
    expect(report.pendingAfter).toBe(0)
    expect(report.iframeCount).toBe(0)
  })

  test('total timeout bounds wall clock without fabricating success', async ({ page }) => {
    await page.setContent(`<!doctype html><html><body></body></html>`)
    await page.addScriptTag({ content: readSdkIife() })

    const report = await page.evaluate(async () => {
      const NightWatch = (
        globalThis as typeof globalThis & {
          NightWatch: {
            loadWithResourceBudget: (o: {
              delayFallback?: number
              monitoring?: boolean
              budget: { totalTimeoutMs: number }
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  components: Record<string, { value?: unknown; error?: unknown }>
                }>
              }
              getPendingTimerCount: () => number
            }>
            SourceTimeoutError: new (...args: unknown[]) => Error
            CollectionTimeoutError: new (...args: unknown[]) => Error
          }
        }
      ).NightWatch

      const started = performance.now()
      let thrownName: string | undefined
      let errorCount = 0
      let keyCount = 0
      let hasApplePay = false
      let pending = 0

      try {
        const { agent, getPendingTimerCount } = await NightWatch.loadWithResourceBudget({
          delayFallback: 0,
          monitoring: false,
          // Tiny budget: force abort while collectors are starting / in flight.
          budget: { totalTimeoutMs: 1 },
        })

        // Yield so the 1ms total timer can fire before get races complete.
        await new Promise((r) => setTimeout(r, 10))

        const result = await agent.get()
        keyCount = Object.keys(result.components).length
        hasApplePay = Object.prototype.hasOwnProperty.call(result.components, 'applePay')
        errorCount = Object.keys(result.components).filter((key) => {
          const component = result.components[key]
          return component != null && 'error' in component
        }).length
        pending = getPendingTimerCount()
      } catch (err) {
        thrownName = err instanceof Error ? err.name : String(err)
      }

      const elapsed = performance.now() - started
      return {
        elapsed,
        errorCount,
        thrownName,
        pending,
        keyCount,
        hasApplePay,
      }
    })

    expect(report.elapsed).toBeLessThan(2000)
    expect(report.pending).toBe(0)
    expect(report.hasApplePay).toBe(false)
    // Either error components or a budget abort/timeout throw — never a silent full success.
    expect(
      report.errorCount > 0 ||
        report.thrownName === 'CollectionTimeoutError' ||
        report.thrownName === 'CollectionAbortError' ||
        report.thrownName === 'AbortError',
    ).toBe(true)
    if (report.thrownName === undefined) {
      expect(report.keyCount).toBe(41)
    }
  })
})
