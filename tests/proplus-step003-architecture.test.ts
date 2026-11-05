import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('STEP 003 architecture ledger and ADRs', () => {
  const ledger = JSON.parse(read('docs/proplus-architecture/architecture-ledger.json')) as {
    trustBoundaries: Array<{ id: string; trust: string; failureMode: string }>
    adrs: string[]
    stackDecisions: Record<string, string>
    latencyBudgetsMs: Record<string, number>
    excluded: string[]
    identityPlanes: Record<string, string>
  }

  const adrDoc = read('docs/proplus-architecture/ADR_INDEX.md')
  const c4 = read('docs/proplus-architecture/C4_AND_FLOWS.md')

  it('records critical trust boundaries with failure modes', () => {
    const ids = ledger.trustBoundaries.map((b) => b.id)
    for (const required of [
      'browser_untrusted',
      'edge_conditional',
      'server_authoritative',
      'postgres_sor',
      'redis_ephemeral',
      'operator_rbac',
    ]) {
      expect(ids).toContain(required)
    }
    expect(ledger.trustBoundaries.every((b) => b.failureMode.length > 0)).toBe(true)
    expect(c4).toContain('Trust boundaries')
    expect(c4).toContain('Failure modes')
  })

  it('ADRs justify .NET, Postgres, and Redis', () => {
    expect(ledger.adrs).toEqual(
      expect.arrayContaining(['ADR-P002', 'ADR-P003', 'ADR-P004', 'ADR-P005']),
    )
    expect(ledger.stackDecisions.backend).toBe('aspnet_core_modular_monolith')
    expect(ledger.stackDecisions.database).toBe('postgresql')
    expect(ledger.stackDecisions.cache).toBe('redis')
    expect(ledger.stackDecisions.runtimeCloudDependency).toBe('none')
    expect(adrDoc).toMatch(/ADR-P002[\s\S]*ASP\.NET Core/)
    expect(adrDoc).toMatch(/ADR-P003[\s\S]*PostgreSQL/)
    expect(adrDoc).toMatch(/ADR-P004[\s\S]*Redis/)
  })

  it('keeps dual identity planes and exclusions', () => {
    expect(ledger.identityPlanes.legacyBrowser).toBe('default-v1')
    expect(ledger.identityPlanes.server).toBe('night-watch-identity-v0')
    expect(ledger.excluded).toEqual(
      expect.arrayContaining(['applePay', 'native_mobile_sdks', 'vendor_fingerprint_saas']),
    )
    expect(ledger.latencyBudgetsMs.identifySyncP95).toBeLessThanOrEqual(250)
  })

  it('C4 docs include mermaid container and component views', () => {
    expect(c4).toContain('```mermaid')
    expect(c4).toContain('ASP.NET Core')
    expect(c4).toContain('Angular')
  })
})
