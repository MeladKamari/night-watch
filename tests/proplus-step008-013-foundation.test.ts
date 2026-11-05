import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  DEFAULT_PRIVACY_POLICY,
  assertPurposeAllowed,
} from '@night-watch/contracts'
import { ENABLED_SOURCES, hashComponents, type UnknownComponents } from '@night-watch/core'
import { runProPlusBridge } from '@night-watch/browser-adapter'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function synthetic() {
  const components: UnknownComponents = Object.fromEntries(
    ENABLED_SOURCES.map((n) => [n, { value: n, duration: 0 }]),
  )
  return {
    components,
    visitorId: hashComponents(components),
    confidence: { score: 0.6 },
    version: '1.0.0',
  }
}

describe('STEP 008 privacy', () => {
  it('ships threat model and default suppression without telemetry/geo/mic', () => {
    expect(existsSync(join(root, 'docs/proplus-privacy/THREAT_MODEL_AND_RETENTION.md'))).toBe(true)
    expect(DEFAULT_PRIVACY_POLICY.telemetryDefault).toBe('off')
    expect(DEFAULT_PRIVACY_POLICY.forbiddenCapabilities).toContain('applePay')
    expect(DEFAULT_PRIVACY_POLICY.suppressedByDefault).toEqual(
      expect.arrayContaining(['geolocation', 'microphone', 'contacts', 'advertisingId']),
    )
    expect(assertPurposeAllowed(undefined, ['fraud_prevention'], true)).toEqual({
      ok: false,
      reason: 'purpose_required',
    })
    expect(assertPurposeAllowed('fraud_prevention', ['fraud_prevention'], true)).toEqual({
      ok: true,
    })
  })
})

describe('STEP 011 bridge modes', () => {
  it('preserves legacy visitorId and skips network when not pro_plus', async () => {
    const result = synthetic()
    let fetched = 0
    const off = await runProPlusBridge(result, {
      mode: 'off',
      purpose: 'fraud_prevention',
      consentStatus: 'granted',
      fetchImpl: async () => {
        fetched++
        return new Response('{}')
      },
    })
    expect(off.visitorId).toBe(result.visitorId)
    expect(off.networkAttempted).toBe(false)
    expect(fetched).toBe(0)

    const browserOnly = await runProPlusBridge(result, {
      mode: 'browser_only',
      purpose: 'fraud_prevention',
      consentStatus: 'granted',
    })
    expect(browserOnly.networkAttempted).toBe(false)

    const denied = await runProPlusBridge(result, {
      mode: 'pro_plus',
      purpose: 'fraud_prevention',
      consentStatus: 'denied',
      endpoint: 'https://fp.example.ir/v1/identify',
      fetchImpl: async () => {
        fetched++
        return new Response('{}')
      },
    })
    expect(denied.status).toBe('blocked_by_policy')
    expect(fetched).toBe(0)
  })
})

describe('STEP 012 ledger audit', () => {
  it('audits 29 smart signals with 10 native deferred', () => {
    const r = spawnSync(process.execPath, ['scripts/ci/proplus-ledger-audit.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(r.status, r.stderr + r.stdout).toBe(0)
    const ledger = JSON.parse(
      readFileSync(join(root, 'docs/proplus-feature-coverage.json'), 'utf8'),
    )
    expect(ledger.smartSignals).toHaveLength(29)
    expect(ledger.managementFeatures.length).toBeGreaterThanOrEqual(5)
  })
})

describe('STEP 013 Iran operational fixtures', () => {
  it('models fa-IR / Tehran / CGNAT / VPN without auto-block', () => {
    const fixture = JSON.parse(
      readFileSync(join(root, 'tests/fixtures/proplus/acceptance.json'), 'utf8'),
    )
    expect(fixture.locale).toBe('fa-IR')
    expect(fixture.timeZone).toBe('Asia/Tehran')
    expect(fixture.presentationOnly).toEqual(
      expect.arrayContaining(['persianDigits', 'rtl']),
    )
    expect(fixture.network.vpnOnlyAutoBlock).toBe(false)
    expect(fixture.network.cgnatSharedIp).toBe(true)
    expect(fixture.deviceTests.physicalIranMatrix).toBe('NOT_RUN')
    expect(fixture.deviceTests.mockedUnitFixtures).toBe('validated_here')
  })
})
