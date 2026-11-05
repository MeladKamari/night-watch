import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertNoDynamicCodePatterns, reducedPermissionFallback } from './csp.js'
import { createAgentBrowserOnly, isBrowserRuntime } from './frameworks.js'
import { buildRedactedDiagnostics, defaultAvailabilityStub } from './diagnostics.js'
import { runBrowserReleaseGate, UNSUPPORTED_NATIVE_FEATURES } from './release-gate.js'

describe('CSP and frameworks', () => {
  it('flags eval patterns and SSR-guards agent', () => {
    expect(assertNoDynamicCodePatterns('const x = 1')).toEqual([])
    expect(assertNoDynamicCodePatterns('eval("1")')).toContain('eval')
    expect(isBrowserRuntime()).toBe(false) // vitest node
    expect(createAgentBrowserOnly()).toBeNull()
    expect(reducedPermissionFallback({ isIframe: true, storageBlocked: true }).mode).toBe('reduced')
  })
})

describe('Diagnostics and release gate', () => {
  it('redacts and lists unsupported native features', () => {
    const diag = buildRedactedDiagnostics({
      availability: defaultAvailabilityStub().slice(0, 3),
      policy: { version: 'v1', decision: 'deny', purposes: [] },
      proRequestAttempted: false,
    })
    expect(diag.notes.join(' ')).toMatch(/omitted/)
    expect(JSON.stringify(diag)).not.toMatch(/Bearer |sk_|api[_-]?secret/i)
    expect(JSON.stringify(diag)).not.toContain('192.168.')
    expect(UNSUPPORTED_NATIVE_FEATURES).toHaveLength(10)

    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, 'agent.ts'), 'utf8')
    const gate = runBrowserReleaseGate(src)
    expect(gate.sourceCountOk).toBe(true)
    expect(gate.noEval).toBe(true)
    expect(gate.noCrossDeviceGuarantee).toBe(true)
  })
})
