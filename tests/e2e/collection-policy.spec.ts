import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in collection policy', () => {
  test('denied consent never collects; omit audio changes visitorId vs full load', async ({
    page,
  }) => {
    await page.setContent(
      `<!doctype html><html lang="en"><body>
        <label><input id="consent" type="checkbox" /> Consent</label>
        <pre id="out">idle</pre>
      </body></html>`,
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
            loadWithCollectionPolicy: (o: {
              delayFallback?: number
              monitoring?: boolean
              policy: {
                consent: { status: string; purpose?: string }
                omitCategories?: string[]
              }
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  components: Record<string, unknown>
                }>
              }
              resolution: {
                excludedSources: string[]
                visitorIdWillDifferFromFullDefault: boolean
              }
            }>
            CollectionConsentError: new (status: string) => Error
          }
        }
      ).NightWatch

      let deniedError: string | undefined
      try {
        await NightWatch.loadWithCollectionPolicy({
          delayFallback: 0,
          monitoring: false,
          policy: { consent: { status: 'denied' } },
        })
      } catch (err) {
        deniedError = err instanceof Error ? err.name : String(err)
      }

      const fullAgent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const full = await fullAgent.get()

      const { agent, resolution } = await NightWatch.loadWithCollectionPolicy({
        delayFallback: 0,
        monitoring: false,
        policy: {
          consent: { status: 'granted', purpose: 'e2e-local-only' },
          omitCategories: ['audio'],
        },
      })
      const partial = await agent.get()

      return {
        deniedError,
        fullCount: Object.keys(full.components).length,
        partialCount: Object.keys(partial.components).length,
        fullHasAudio: Object.prototype.hasOwnProperty.call(full.components, 'audio'),
        partialHasAudio: Object.prototype.hasOwnProperty.call(partial.components, 'audio'),
        fullId: full.visitorId,
        partialId: partial.visitorId,
        excluded: resolution.excludedSources,
        willDiffer: resolution.visitorIdWillDifferFromFullDefault,
        hasApplePay: Object.prototype.hasOwnProperty.call(full.components, 'applePay'),
      }
    })

    expect(report.deniedError).toBe('CollectionConsentError')
    expect(report.fullCount).toBe(41)
    expect(report.partialCount).toBe(39)
    expect(report.fullHasAudio).toBe(true)
    expect(report.partialHasAudio).toBe(false)
    expect(report.excluded).toEqual(['audio', 'audioBaseLatency'])
    expect(report.willDiffer).toBe(true)
    expect(report.fullId).not.toBe(report.partialId)
    expect(report.hasApplePay).toBe(false)
  })
})
