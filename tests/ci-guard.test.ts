import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

type GuardModule = {
  stripComments: (source: string) => string
  scanSourceText: (
    filePath: string,
    text: string,
  ) => Array<{ file: string; id: string; detail: string }>
  scanBundleText: (
    filePath: string,
    text: string,
  ) => Array<{ file: string; id: string; detail: string }>
  scanRegistryEnabledSources: (
    registryText: string,
  ) => Array<{ file: string; id: string; detail: string }>
  runGuard: (root?: string) => {
    ok: boolean
    violations: Array<{ file: string; id: string; detail: string }>
  }
}

const guardUrl = pathToFileURL(
  join(process.cwd(), 'scripts/ci/guard-excluded-payment-source.mjs'),
).href

async function loadGuard(): Promise<GuardModule> {
  return (await import(guardUrl)) as GuardModule
}

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('CI excluded payment-source guard', () => {
  it('strips comments but keeps string literals', async () => {
    const { stripComments } = await loadGuard()
    const src = `const a = 1; // getApplePay()\n/* ApplePaySession */ const b = 'keep'`
    const out = stripComments(src)
    expect(out).not.toContain('getApplePay')
    expect(out).not.toContain('ApplePaySession')
    expect(out).toContain("'keep'")
  })

  it('allows exclusion constants and ApplePayError engine probe', async () => {
    const { scanSourceText } = await loadGuard()
    const text = `
export const EXCLUDED_UPSTREAM_SOURCE = 'applePay' as const
export const APPLE_PAY_EXCLUDED = true
function probe(w: Window) {
  return 'ApplePayError' in w
}
`
    expect(scanSourceText('packages/core/src/registry.ts', text)).toEqual([])
  })

  it('flags getApplePay collector and ApplePaySession API', async () => {
    const { scanSourceText } = await loadGuard()
    const bad = `
export function getApplePay() { return -1 }
const x = window.ApplePaySession
`
    const hits = scanSourceText('packages/browser-sdk/src/sources/apple_pay.ts', bad)
    expect(hits.some((h) => h.id === 'getApplePay')).toBe(true)
    expect(hits.some((h) => h.id === 'ApplePaySession')).toBe(true)
    expect(hits.some((h) => h.id === 'forbidden_filename')).toBe(true)
  })

  it('flags applePay registration property outside allowlist', async () => {
    const { scanSourceText } = await loadGuard()
    const bad = `export const sources = { applePay: getSomething }`
    const hits = scanSourceText('packages/browser-sdk/src/sources/index.ts', bad)
    expect(hits.some((h) => h.id === 'applePay_source_prop')).toBe(true)
  })

  it('detects applePay inside ENABLED_SOURCES array', async () => {
    const { scanRegistryEnabledSources } = await loadGuard()
    const bad = `export const ENABLED_SOURCES = ['fonts', 'applePay', 'canvas'] as const`
    const hits = scanRegistryEnabledSources(bad)
    expect(hits.some((h) => h.id === 'ENABLED_SOURCES_contains_applePay')).toBe(true)
  })

  it('flags getApplePay in built bundles', async () => {
    const { scanBundleText } = await loadGuard()
    const hits = scanBundleText('packages/browser-sdk/dist/fp.min.js', 'function getApplePay(){}')
    expect(hits.some((h) => h.id === 'getApplePay')).toBe(true)
  })

  it('runGuard passes on the real repository', async () => {
    const { runGuard } = await loadGuard()
    const result = runGuard(process.cwd())
    expect(result.ok, JSON.stringify(result.violations, null, 2)).toBe(true)
  })

  it('runGuard fails when a synthetic production tree registers applePay', async () => {
    const { runGuard } = await loadGuard()
    const root = mkdtempSync(join(tmpdir(), 'night-watch-guard-'))
    tempDirs.push(root)
    const srcDir = join(root, 'packages/browser-sdk/src/sources')
    mkdirSync(srcDir, { recursive: true })
    mkdirSync(join(root, 'packages/core/src'), { recursive: true })
    writeFileSync(
      join(root, 'packages/core/src/registry.ts'),
      `export const ENABLED_SOURCES = ['fonts'] as const\n`,
    )
    writeFileSync(
      join(srcDir, 'evil.ts'),
      `export function getApplePay() { return 0 }\n`,
    )
    const result = runGuard(root)
    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => v.id === 'getApplePay')).toBe(true)
  })
})
