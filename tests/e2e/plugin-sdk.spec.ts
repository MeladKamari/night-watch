import { expect, test } from '@playwright/test'
import { readSdkIife } from './helpers/inject-sdk.js'

test.describe('opt-in custom plugin SDK', () => {
  test('plugins append namespaced keys; default load stays 41; cleanup runs', async ({
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
            loadWithPlugins: (o: {
              delayFallback?: number
              monitoring?: boolean
              plugins: Array<{
                id: string
                key: string
                version: string
                collect: () => unknown
                cleanup?: (ctx: { reason: string }) => void
              }>
            }) => Promise<{
              agent: {
                get: () => Promise<{
                  visitorId: string
                  components: Record<string, { value?: unknown; error?: { name?: string } }>
                }>
              }
              resolution: {
                visitorIdWillDifferFromFullDefault: boolean
                pluginKeys: string[]
                manifest: { revision: string }
              }
            }>
            createPersianFontProbePlugin: () => {
              id: string
              key: string
              version: string
              collect: () => unknown
            }
            PLUGIN_SDK_REVISION: string
          }
        }
      ).NightWatch

      const fullAgent = await NightWatch.load({ delayFallback: 0, monitoring: false })
      const full = await fullAgent.get()

      let cleanupReason: string | undefined
      const { agent, resolution } = await NightWatch.loadWithPlugins({
        delayFallback: 0,
        monitoring: false,
        plugins: [
          {
            id: 'demo',
            key: 'ext:demo',
            version: '1.0.0',
            collect: () => ({ mark: 'fa-IR', dir: 'rtl' }),
            cleanup: (ctx) => {
              cleanupReason = ctx.reason
            },
          },
          NightWatch.createPersianFontProbePlugin(),
        ],
      })
      const withPlugins = await agent.get()

      return {
        revision: NightWatch.PLUGIN_SDK_REVISION,
        fullCount: Object.keys(full.components).length,
        fullHasExt: Object.keys(full.components).some((k) => k.startsWith('ext:')),
        fullId: full.visitorId,
        pluginCount: Object.keys(withPlugins.components).length,
        pluginId: withPlugins.visitorId,
        hasDemo: Object.prototype.hasOwnProperty.call(withPlugins.components, 'ext:demo'),
        hasPersian: Object.prototype.hasOwnProperty.call(
          withPlugins.components,
          'ext:persianFontProbe',
        ),
        willDiffer: resolution.visitorIdWillDifferFromFullDefault,
        pluginKeys: resolution.pluginKeys,
        cleanupReason,
        hasApplePay: Object.prototype.hasOwnProperty.call(full.components, 'applePay'),
        persianValue: withPlugins.components['ext:persianFontProbe'],
      }
    })

    expect(report.revision).toBe('night-watch-plugin-sdk-v1')
    expect(report.fullCount).toBe(41)
    expect(report.fullHasExt).toBe(false)
    expect(report.pluginCount).toBe(43)
    expect(report.hasDemo).toBe(true)
    expect(report.hasPersian).toBe(true)
    expect(report.willDiffer).toBe(true)
    expect(report.pluginId).not.toBe(report.fullId)
    expect(report.cleanupReason).toBe('success')
    expect(report.hasApplePay).toBe(false)
    expect(report.pluginKeys).toEqual(
      expect.arrayContaining(['ext:demo', 'ext:persianFontProbe']),
    )
    expect(report.persianValue).toHaveProperty('value')
  })
})
