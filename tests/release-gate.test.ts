import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ENABLED_SOURCE_COUNT, ENABLED_SOURCES } from '@thenightwatch/core'
import { SDK_PACKAGE_VERSION } from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gateUrl = pathToFileURL(join(root, 'scripts/ci/release-gate.mjs')).href

type GateModule = {
  SOURCE_TEST_BASENAMES: Record<string, string>
  runReleaseGate: (root?: string) => Promise<{
    ok: boolean
    version: string
    enabledSourceCount: number
    checks: Array<{ id: string; ok: boolean; detail: string }>
  }>
}

describe('release gate (1.x)', () => {
  it('maps all 41 enabled sources to unit+e2e basenames', async () => {
    const gate = (await import(gateUrl)) as GateModule
    expect(Object.keys(gate.SOURCE_TEST_BASENAMES)).toHaveLength(41)
    for (const name of ENABLED_SOURCES) {
      expect(gate.SOURCE_TEST_BASENAMES[name], name).toBeTypeOf('string')
    }
    expect(ENABLED_SOURCE_COUNT).toBe(41)
    expect(SDK_PACKAGE_VERSION).toBe('1.0.0')
  })

  it('runReleaseGate passes on the built workspace', async () => {
    const gate = (await import(gateUrl)) as GateModule
    const report = await gate.runReleaseGate(root)
    const failed = report.checks.filter((c) => !c.ok)
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.enabledSourceCount).toBe(41)
    expect(report.version).toBe('1.0.0')
  })
})
