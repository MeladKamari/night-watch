import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in namespaced identity', () => {
  test('namespaces separate ids; default load stays unsalted; no storage writes', async ({
    page,
  }) => {
    // Loopback origin (playground) so storage access is allowed for the no-write assertion.
    await page.goto('/')
    await page.addScriptTag({ content: readSdkIife() })

    const report = await page.evaluate(async () => {
      const NightWatch = (
        globalThis as typeof globalThis & {
          NightWatch: {
            load: (o?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
              get: () => Promise<{ visitorId: string }>
            }>
            loadWithIdentityScope: (o: {
              delayFallback?: number
              monitoring?: boolean
              identity: { namespace: string; salt?: string; domain?: string }
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  baselineVisitorId: string
                  identity: { upstreamCompatible: boolean; hasSalt: boolean; algorithm: string }
                }>
              }
            }>
          }
        }
      ).NightWatch

      const probeKey = '__ibf_identity_probe__'
      localStorage.removeItem(probeKey)
      sessionStorage.removeItem(probeKey)
      const beforeLocal = localStorage.length
      const beforeSession = sessionStorage.length

      const defaultAgent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const defaultResult = await defaultAgent.get()

      const scopedA = await NightWatch.loadWithIdentityScope({
        delayFallback: 0,
        monitoring: false,
        identity: { namespace: 'ns-a', salt: 's1', domain: 'demo' },
      })
      const a = await scopedA.agent.get()

      const scopedB = await NightWatch.loadWithIdentityScope({
        delayFallback: 0,
        monitoring: false,
        identity: { namespace: 'ns-b', salt: 's1', domain: 'demo' },
      })
      const b = await scopedB.agent.get()

      const rotated = await NightWatch.loadWithIdentityScope({
        delayFallback: 0,
        monitoring: false,
        identity: { namespace: 'ns-a', salt: 's2', domain: 'demo' },
      })
      const rotatedResult = await rotated.agent.get()

      return {
        defaultId: defaultResult.visitorId,
        aId: a.visitorId,
        bId: b.visitorId,
        aBaseline: a.baselineVisitorId,
        rotatedId: rotatedResult.visitorId,
        upstreamCompatible: a.identity.upstreamCompatible,
        algorithm: a.identity.algorithm,
        hasSalt: a.identity.hasSalt,
        storageUnchanged:
          localStorage.length === beforeLocal &&
          sessionStorage.length === beforeSession &&
          localStorage.getItem(probeKey) === null &&
          sessionStorage.getItem(probeKey) === null,
      }
    })

    expect(report.aBaseline).toBe(report.defaultId)
    expect(report.aId).not.toBe(report.defaultId)
    expect(report.aId).not.toBe(report.bId)
    expect(report.rotatedId).not.toBe(report.aId)
    expect(report.upstreamCompatible).toBe(false)
    expect(report.algorithm).toBe('night-watch-namespaced-v1')
    expect(report.hasSalt).toBe(true)
    expect(report.storageUnchanged).toBe(true)
  })
})
