import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in entropy experiment harness', () => {
  test('consent-gated rebuilds produce local aggregates without network', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="fa" dir="rtl"><body></body></html>`)
    await page.addScriptTag({ content: readSdkIife() })

    const report = await page.evaluate(async () => {
      const NightWatch = (
        globalThis as typeof globalThis & {
          NightWatch: {
            createEntropyExperimentHarness: (o: {
              consent: { status: string; purpose?: string }
              maxSamples?: number
            }) => {
              collectRebuilds: (
                n: number,
                load?: { delayFallback?: number; monitoring?: boolean },
                cohort?: string,
              ) => Promise<unknown[]>
              aggregate: () => {
                revision: string
                sampleCount: number
                disclaimer: string
                withinBrowser: Array<{ cohort: string; sampleSize: number }>
              }
              clearSamples: () => void
              sampleCount: number
            }
            ENTROPY_EXPERIMENTS_REVISION: string
            ExperimentConsentError: new (...args: unknown[]) => Error
          }
        }
      ).NightWatch

      const networkCalls: string[] = []
      const originalFetch = globalThis.fetch?.bind(globalThis)
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        networkCalls.push(String(args[0]))
        if (originalFetch) return originalFetch(...args)
        throw new Error('blocked')
      }) as typeof fetch

      let denied = false
      try {
        NightWatch.createEntropyExperimentHarness({ consent: { status: 'denied' } })
      } catch (err) {
        denied = err instanceof Error && err.name === 'ExperimentConsentError'
      }

      const harness = NightWatch.createEntropyExperimentHarness({
        consent: { status: 'granted', purpose: 'e2e-lab' },
        maxSamples: 20,
      })
      await harness.collectRebuilds(5, { delayFallback: 0, monitoring: false }, 'chromium')
      const agg = harness.aggregate()
      harness.clearSamples()

      return {
        denied,
        revision: agg.revision,
        expected: NightWatch.ENTROPY_EXPERIMENTS_REVISION,
        sampleCount: agg.sampleCount,
        afterClear: harness.sampleCount,
        cohort: agg.withinBrowser[0]?.cohort,
        disclaimer: agg.disclaimer,
        networkCalls,
      }
    })

    expect(report.denied).toBe(true)
    expect(report.revision).toBe(report.expected)
    expect(report.sampleCount).toBe(5)
    expect(report.afterClear).toBe(0)
    expect(report.cohort).toBe('chromium')
    expect(report.disclaimer.toLowerCase()).toContain('lab aggregate')
    expect(report.networkCalls).toEqual([])
  })
})
