import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in reliability profiles', () => {
  test('diagnostic matches default load; conservative omits volatile and changes visitorId', async ({
    page,
  }) => {
    await page.setContent(
      `<!doctype html><html lang="en"><body><pre id="out">idle</pre></body></html>`,
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
            loadWithReliabilityProfile: (o: {
              delayFallback?: number
              monitoring?: boolean
              profile: string
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  components: Record<string, unknown>
                }>
              }
              resolution: {
                visitorIdWillDifferFromFullDefault: boolean
                manifest: {
                  revision: string
                  profileId: string
                  includedCount: number
                  excludedCount: number
                  excludedSources: string[]
                }
              }
            }>
            RELIABILITY_PROFILES_REVISION: string
            getReliabilityProfileManifest: (id: string) => {
              includedCount: number
              excludedCount: number
            }
          }
        }
      ).NightWatch

      const fullAgent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const full = await fullAgent.get()

      const { agent: diagAgent, resolution: diagRes } = await NightWatch.loadWithReliabilityProfile({
        delayFallback: 0,
        monitoring: false,
        profile: 'diagnostic',
      })
      const diagnostic = await diagAgent.get()

      const { agent: consAgent, resolution: consRes } = await NightWatch.loadWithReliabilityProfile({
        delayFallback: 0,
        monitoring: false,
        profile: 'conservative',
      })
      const conservative = await consAgent.get()

      const { agent: balAgent, resolution: balRes } = await NightWatch.loadWithReliabilityProfile({
        delayFallback: 0,
        monitoring: false,
        profile: 'balanced',
      })
      const balanced = await balAgent.get()

      return {
        revision: NightWatch.RELIABILITY_PROFILES_REVISION,
        fullCount: Object.keys(full.components).length,
        diagCount: Object.keys(diagnostic.components).length,
        consCount: Object.keys(conservative.components).length,
        balCount: Object.keys(balanced.components).length,
        fullId: full.visitorId,
        diagId: diagnostic.visitorId,
        consId: conservative.visitorId,
        balId: balanced.visitorId,
        diagWillDiffer: diagRes.visitorIdWillDifferFromFullDefault,
        consWillDiffer: consRes.visitorIdWillDifferFromFullDefault,
        balWillDiffer: balRes.visitorIdWillDifferFromFullDefault,
        consHasCanvas: Object.prototype.hasOwnProperty.call(conservative.components, 'canvas'),
        balHasCanvas: Object.prototype.hasOwnProperty.call(balanced.components, 'canvas'),
        balHasLanguages: Object.prototype.hasOwnProperty.call(balanced.components, 'languages'),
        consExcluded: consRes.manifest.excludedSources,
        hasApplePay: Object.prototype.hasOwnProperty.call(full.components, 'applePay'),
        consManifestCount: NightWatch.getReliabilityProfileManifest('conservative').includedCount,
      }
    })

    expect(report.revision).toBe('night-watch-reliability-profiles-v1')
    expect(report.fullCount).toBe(41)
    expect(report.diagCount).toBe(41)
    expect(report.diagId).toBe(report.fullId)
    expect(report.diagWillDiffer).toBe(false)

    expect(report.consWillDiffer).toBe(true)
    expect(report.balWillDiffer).toBe(true)
    expect(report.consId).not.toBe(report.fullId)
    expect(report.balId).not.toBe(report.fullId)
    expect(report.balId).not.toBe(report.consId)
    expect(report.consHasCanvas).toBe(false)
    expect(report.balHasCanvas).toBe(false)
    expect(report.balHasLanguages).toBe(true)
    expect(report.consCount).toBe(report.consManifestCount)
    expect(report.consExcluded).toContain('canvas')
    expect(report.consExcluded).toContain('audio')
    expect(report.hasApplePay).toBe(false)
  })
})
