import {
  DIAGNOSTICS_REVISION,
  DIAGNOSTICS_SNAPSHOT_SCHEMA,
  DiagnosticsValidationError,
  FORBIDDEN_PAGE_CONTEXT_KEYS,
  buildDiagnosticSnapshot,
  createBuiltinSources,
  deriveReproLabel,
  exportDiagnosticSnapshot,
  findForbiddenPageContextKeys,
  hashReproSeed,
  load,
  loadWithDiagnostics,
  parseDiagnosticSnapshotJson,
  redactDeep,
  redactErrorForDiagnostics,
  validateDiagnosticSnapshot,
  type GetResult,
} from '@thenightwatch/browser-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

function sampleResult(overrides: Partial<GetResult> = {}): GetResult {
  return {
    visitorId: '0123456789abcdef0123456789abcdef',
    confidence: { score: 0.5, comment: 'heuristic' },
    components: {
      platform: { value: 'Win32', duration: 1 },
      math: { value: { acos: 1.2 }, duration: 1 },
      timezone: { value: 'Asia/Tehran', duration: 1 },
    },
    version: '1.0.0',
    ...overrides,
  }
}

describe('diagnostics redaction', () => {
  it('redacts forbidden page-context keys and URLs in errors', () => {
    expect(FORBIDDEN_PAGE_CONTEXT_KEYS).toContain('href')
    expect(FORBIDDEN_PAGE_CONTEXT_KEYS).toContain('cookie')

    const redacted = redactDeep({
      href: 'https://shop.example/checkout?token=abc',
      title: 'Secret',
      platform: 'Win32',
      nested: { cookie: 'a=b', safe: 'ok' },
    }) as Record<string, unknown>

    expect(redacted.href).toBe('[redacted]')
    expect(redacted.title).toBe('[redacted]')
    expect(redacted.platform).toBe('Win32')
    expect((redacted.nested as Record<string, unknown>).cookie).toBe('[redacted]')
    expect((redacted.nested as Record<string, unknown>).safe).toBe('ok')

    const err = redactErrorForDiagnostics(
      new Error('failed at https://evil.example/path and file:///C:/Users/me/app'),
    )
    expect(String(err.message)).toContain('[url]')
    expect(String(err.message)).toContain('[file-url]')
    expect(String(err.message)).not.toContain('evil.example')
  })
})

describe('repro seed', () => {
  it('hashes stably and derives labels without changing default hashing API', () => {
    expect(hashReproSeed('lab-fa-IR')).toMatch(/^[0-9a-f]{32}$/)
    expect(hashReproSeed('lab-fa-IR')).toBe(hashReproSeed('lab-fa-IR'))
    expect(hashReproSeed('lab-fa-IR')).not.toBe(hashReproSeed('lab-en'))
    expect(deriveReproLabel('seed', 'fixture-a')).not.toBe(deriveReproLabel('seed', 'fixture-b'))
  })
})

describe('diagnostic snapshots', () => {
  it('builds schema-valid snapshots and round-trips JSON', () => {
    const snapshot = buildDiagnosticSnapshot(sampleResult(), {
      exportedAt: '2026-11-03T00:00:00.000Z',
      reproSeed: 'lab-1',
      includeEnvironment: false,
    })

    expect(snapshot.schema).toBe(DIAGNOSTICS_SNAPSHOT_SCHEMA)
    expect(snapshot.revision).toBe(DIAGNOSTICS_REVISION)
    expect(snapshot.reproSeedHash).toBe(hashReproSeed('lab-1'))
    expect(snapshot.reproSeed).toBeUndefined()
    expect(snapshot.componentKeys).not.toContain('applePay')
    expect(findForbiddenPageContextKeys(snapshot)).toEqual([])

    const validation = validateDiagnosticSnapshot(snapshot)
    expect(validation.ok).toBe(true)

    const exported = exportDiagnosticSnapshot(sampleResult(), {
      exportedAt: '2026-11-03T00:00:00.000Z',
      reproSeed: 'lab-1',
    })
    expect(exported.byteLength).toBeGreaterThan(10)
    const parsed = parseDiagnosticSnapshotJson(exported.json)
    expect(parsed.visitorId).toBe(snapshot.visitorId)
    expect(parsed.reproSeedHash).toBe(snapshot.reproSeedHash)
  })

  it('rejects snapshots that leak page context or applePay', () => {
    const bad = {
      ...buildDiagnosticSnapshot(sampleResult(), { exportedAt: '2026-11-03T00:00:00.000Z' }),
      environment: {
        pageContextRedacted: true as const,
        href: 'https://leak.example/',
      },
    }
    const result = validateDiagnosticSnapshot(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => /href/i.test(e))).toBe(true)
    }

    const withApple = buildDiagnosticSnapshot(
      sampleResult({
        components: {
          applePay: { value: 1, duration: 1 },
          platform: { value: 'x', duration: 1 },
        },
      }),
      { exportedAt: '2026-11-03T00:00:00.000Z' },
    )
    // build allows recording but validate rejects applePay key
    expect(validateDiagnosticSnapshot(withApple).ok).toBe(false)
  })

  it('redacts error components in snapshots', () => {
    const snapshot = buildDiagnosticSnapshot(
      sampleResult({
        components: {
          canvas: {
            error: Object.assign(new Error('boom https://x.test/a'), {
              authorization: 'Bearer secret',
            }),
            duration: 3,
          },
        },
      }),
      { exportedAt: '2026-11-03T00:00:00.000Z' },
    )
    const canvas = snapshot.components.canvas!
    expect(canvas.error).toBeDefined()
    expect(JSON.stringify(canvas.error)).toContain('[url]')
    expect(JSON.stringify(canvas.error)).toContain('[redacted]')
    expect(JSON.stringify(canvas.error)).not.toContain('Bearer secret')
  })
})

describe('loadWithDiagnostics / no analytics network', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('default load is unchanged when diagnostics API is unused', async () => {
    const agent = await load({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: createBuiltinSources(),
    })
    const result = await agent.get()
    expect(Object.keys(result.components)).toHaveLength(41)
    expect(Object.keys(result.components)).not.toContain('applePay')
  })

  it('requires explicit export action and never calls fetch/sendBeacon', async () => {
    const fetchSpy = vi.fn()
    const beaconSpy = vi.fn(() => true)
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', {
      sendBeacon: beaconSpy,
      userAgent: 'test',
      language: 'fa-IR',
      languages: ['fa-IR'],
      platform: 'Win32',
    })

    const { agent, diagnosticsRevision } = await loadWithDiagnostics({
      delayFallback: 0,
      allowNonBrowser: true,
      sources: {
        platform: () => 'TestPlatform',
      } as never,
      diagnostics: {
        exportedAt: '2026-11-03T00:00:00.000Z',
        reproSeed: 'fa-IR-lab',
        includeEnvironment: true,
      },
    })

    expect(diagnosticsRevision).toBe(DIAGNOSTICS_REVISION)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(beaconSpy).not.toHaveBeenCalled()

    const { snapshot, json } = await agent.exportDiagnostics()
    expect(snapshot.environment?.pageContextRedacted).toBe(true)
    expect(snapshot.environment).not.toHaveProperty('href')
    expect(snapshot.reproSeedHash).toBe(hashReproSeed('fa-IR-lab'))
    expect(json).toContain(DIAGNOSTICS_SNAPSHOT_SCHEMA)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(beaconSpy).not.toHaveBeenCalled()
  })

  it('throws DiagnosticsValidationError when validation cannot pass', () => {
    expect(() => parseDiagnosticSnapshotJson('{')).toThrow(DiagnosticsValidationError)
  })
})
