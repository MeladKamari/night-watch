import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  UPSTREAM_PIN,
  hashComponents,
  type UnknownComponents,
} from '@thenightwatch/core'
import { readSdkIife } from './helpers/inject-sdk.js'
import {
  buildUpstreamDiffReport,
  formatDiffReportMarkdown,
} from '../harness/diff/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const upstreamIifePath = join(root, 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.min.js')

test.describe('upstream differential (consented local sample)', () => {
  test('compares 41 sources vs filtered upstream; never gates on raw visitorId', async ({
    page,
  }) => {
    const { readFileSync } = await import('node:fs')
    const localIife = readSdkIife()
    const upstreamIife = readFileSync(upstreamIifePath, 'utf8')

    await page.setContent(
      `<!doctype html>
      <html lang="en">
        <body>
          <label>
            <input id="consent" type="checkbox" />
            I consent to a local-only differential sample (no upload).
          </label>
          <button id="run" type="button" disabled>Run differential</button>
          <pre id="out">idle</pre>
        </body>
      </html>`,
    )

    await expect(page.locator('#run')).toBeDisabled()
    await page.locator('#consent').check()
    await page.locator('#run').evaluate((btn) => {
      ;(btn as HTMLButtonElement).disabled = false
    })

    // Inject both first-party copies of the scripts (no CDN). Upstream monitoring disabled.
    await page.addScriptTag({ content: localIife })
    await page.addScriptTag({ content: upstreamIife })

    const sample = await page.evaluate(async () => {
      const consented = (document.getElementById('consent') as HTMLInputElement | null)?.checked
      if (!consented) {
        throw new Error('Consent required')
      }

      const localApi = (globalThis as typeof globalThis & { NightWatch?: LocalApi }).NightWatch
      const upstreamApi = (globalThis as typeof globalThis & { FingerprintJS?: UpstreamApi })
        .FingerprintJS
      if (!localApi?.load || !upstreamApi?.load) {
        throw new Error('Missing NightWatch or FingerprintJS global')
      }

      const localAgent = await localApi.load({ delayFallback: 0, monitoring: false })
      const upstreamAgent = await upstreamApi.load({ delayFallback: 0, monitoring: false })
      const localResult = await localAgent.get()
      const upstreamResult = await upstreamAgent.get()

      return {
        localVisitorId: localResult.visitorId,
        upstreamRawVisitorId: upstreamResult.visitorId,
        localComponents: localResult.components as Record<string, unknown>,
        upstreamComponents: upstreamResult.components as Record<string, unknown>,
        localVersion: localResult.version,
        upstreamVersion: upstreamResult.version,
      }
    })

    expect(Object.keys(sample.localComponents)).toHaveLength(41)
    expect(sample.localComponents).not.toHaveProperty(EXCLUDED_UPSTREAM_SOURCE)
    expect(sample.upstreamComponents).toHaveProperty(EXCLUDED_UPSTREAM_SOURCE)

    const report = buildUpstreamDiffReport({
      consented: true,
      localComponents: sample.localComponents as UnknownComponents,
      upstreamComponents: sample.upstreamComponents as UnknownComponents,
      localVisitorId: sample.localVisitorId,
      upstreamRawVisitorId: sample.upstreamRawVisitorId,
      notes: [
        `Local SDK version: ${sample.localVersion}`,
        `Upstream package version field: ${sample.upstreamVersion}`,
        `Enabled source order locked (${ENABLED_SOURCES.length})`,
        `Upstream pin package ${UPSTREAM_PIN.packageName}@${UPSTREAM_PIN.packageVersion}`,
      ],
    })

    const outDir = join(root, 'reference')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'upstream-diff-report.json'), `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(join(outDir, 'upstream-diff-report.md'), formatDiffReportMarkdown(report))

    // Hard gates
    expect(report.consented).toBe(true)
    expect(report.matchCount + report.mismatchCount).toBe(41)
    expect(report.localHash).toBe(hashComponents(sample.localComponents as UnknownComponents))
    // Raw visitorId must not be used as a pass condition � expect inequality while applePay remains.
    expect(report.rawVisitorIdEqual).toBe(false)

    // Filtered-hash parity is asserted only when all 41 sources match (proven fixture path).
    if (report.matchCount === 41) {
      expect(report.filteredHashEqual).toBe(true)
      expect(report.sourceParityLabel).toBe('41/41')
    } else {
      // Live engines can still diverge slightly (timing/entropy); report must classify, not invent PASS.
      expect(report.filteredHashEqual).toBe(false)
      expect(report.mismatchCount).toBeGreaterThan(0)
      expect(report.sourceRows.some((row) => row.kind !== 'match')).toBe(true)
    }
  })
})

type LocalApi = {
  load: (opts?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
    get: () => Promise<{
      visitorId: string
      version: string
      components: Record<string, unknown>
    }>
  }>
}

type UpstreamApi = {
  load: (opts?: { delayFallback?: number; monitoring?: boolean }) => Promise<{
    get: () => Promise<{
      visitorId: string
      version: string
      components: Record<string, unknown>
    }>
  }>
}
