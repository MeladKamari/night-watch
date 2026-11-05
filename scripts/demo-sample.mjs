import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iife = readFileSync(join(root, 'packages/browser-sdk/dist/fp.min.js'), 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(
  '<!doctype html><html lang="fa" dir="rtl"><body><h1>IBF demo</h1></body></html>',
)
await page.addScriptTag({ content: iife })

const sample = await page.evaluate(async () => {
  const agent = await globalThis.NightWatch.load({ monitoring: false, delayFallback: 0 })
  const r = await agent.get()
  const keys = Object.keys(r.components)
  const summary = {}
  for (const k of keys) {
    const c = r.components[k]
    if (c && 'value' in c) {
      let preview
      try {
        preview = JSON.stringify(c.value)
      } catch {
        preview = String(c.value)
      }
      summary[k] = {
        ok: true,
        duration: c.duration,
        preview: preview == null ? null : preview.slice(0, 120),
      }
    } else {
      const err = c?.error
      summary[k] = {
        ok: false,
        duration: c?.duration ?? 0,
        error: String(err?.name || err).slice(0, 120),
      }
    }
  }
  return {
    visitorId: r.visitorId,
    version: r.version,
    confidence: r.confidence,
    sourceCount: keys.length,
    hasApplePay: keys.includes('applePay'),
    componentKeys: keys,
    components: summary,
  }
})

await browser.close()

const outPath = join(root, 'reference/demo-sample.json')
writeFileSync(outPath, `${JSON.stringify(sample, null, 2)}\n`)

const okCount = Object.values(sample.components).filter((c) => c.ok).length
const errCount = sample.sourceCount - okCount

console.log(
  JSON.stringify(
    {
      wrote: outPath,
      visitorId: sample.visitorId,
      version: sample.version,
      confidence: sample.confidence,
      sourceCount: sample.sourceCount,
      okCount,
      errCount,
      hasApplePay: sample.hasApplePay,
      firstKeys: sample.componentKeys.slice(0, 15),
    },
    null,
    2,
  ),
)
