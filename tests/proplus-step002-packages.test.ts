import {
  ALGORITHM_SCHEMA,
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
  hashComponents,
  type UnknownComponents,
} from '@night-watch/core'
import {
  IDENTITY_ALGORITHM_VERSION,
  NPM_SCOPE,
  PRODUCT_CODE,
  PRODUCT_NAME,
  knownEvidence,
  notApplicableNativeOnly,
  unknownEvidence,
} from '@night-watch/contracts'
import {
  adaptGetResultToObservation,
  expectedLegacySourceCount,
} from '@night-watch/browser-adapter'
import {
  ProPlusServerSdk,
  ProPlusServerSdkError,
  placeholderUnknownServerVisitor,
} from '@night-watch/server-sdk'
import {
  ProPlusDashboardClient,
  ProPlusDashboardClientError,
} from '@night-watch/dashboard-client'
import { describe, expect, it } from 'vitest'

function syntheticGetResult(components: UnknownComponents, version = '1.0.0') {
  return {
    visitorId: hashComponents(components),
    confidence: { score: 0.6, comment: 'heuristic' },
    components,
    version,
  }
}

describe('STEP 002 Pro+ namespace and packages', () => {
  it('uses an independent product name and npm scope (no vendor branding)', () => {
    expect(PRODUCT_NAME).toBe('Night Watch')
    expect(PRODUCT_CODE).toBe('night-watch')
    expect(NPM_SCOPE).toBe('@night-watch')
    expect(IDENTITY_ALGORITHM_VERSION).toBe('night-watch-identity-v0')
    expect(PRODUCT_NAME.toLowerCase()).not.toContain('fingerprint')
    expect(NPM_SCOPE).not.toContain('fingerprint')
  })

  it('adapts legacy SDK output without modifying visitorId / hash', () => {
    const components: UnknownComponents = Object.fromEntries(
      ENABLED_SOURCES.map((name) => [name, { value: name, duration: 0 }]),
    )
    const beforeHash = hashComponents(components)
    const result = syntheticGetResult(components)
    expect(result.visitorId).toBe(beforeHash)

    const envelope = adaptGetResultToObservation(result, {
      purpose: 'lab_inventory',
      consentStatus: 'granted',
      collectedAt: '2026-11-03T00:00:00.000Z',
      nonce: 'n1',
    })

    expect(envelope.legacyBrowser.visitorId).toBe(beforeHash)
    expect(envelope.legacyBrowser.sourceManifestRevision).toBe(SOURCE_MANIFEST_REVISION)
    expect(envelope.legacyBrowser.hashingRevision).toBe(ALGORITHM_SCHEMA.hashingRevision)
    expect(envelope.identityAlgorithmVersion).toBe(IDENTITY_ALGORITHM_VERSION)
    expect(envelope.productCode).toBe(PRODUCT_CODE)
    expect(hashComponents(components)).toBe(beforeHash)
    expect(expectedLegacySourceCount()).toBe(41)
    expect(envelope.legacyBrowser.componentKeys).not.toContain('applePay')
  })

  it('rejects mutated visitorId and applePay leakage', () => {
    const components: UnknownComponents = {
      platform: { value: 'Win32', duration: 0 },
    }
    const good = syntheticGetResult(components)
    expect(() =>
      adaptGetResultToObservation(
        { ...good, visitorId: '00000000000000000000000000000000' },
        { purpose: 'x', consentStatus: 'unknown' },
      ),
    ).toThrow(/does not match hashComponents/)

    const leaked = {
      ...good,
      components: {
        ...components,
        applePay: { value: true, duration: 0 },
      } as UnknownComponents,
      visitorId: hashComponents({
        ...components,
        applePay: { value: true, duration: 0 },
      }),
    }
    expect(() =>
      adaptGetResultToObservation(leaked, { purpose: 'x', consentStatus: 'unknown' }),
    ).toThrow(/applePay/)
  })

  it('exposes honest evidence helpers including native-only deferment', () => {
    expect(unknownEvidence('server').status).toBe('unknown')
    expect(unknownEvidence('server').value).toBeNull()
    expect(knownEvidence(true, 'browser_sdk', 0.1).value).toBe(true)
    const native = notApplicableNativeOnly()
    expect(native.status).toBe('not_applicable')
    expect(native.reason).toBe('requires_native_sdk')
  })

  it('server SDK refuses vendor hosts and reports unavailable without backend', async () => {
    expect(() => new ProPlusServerSdk({ baseUrl: 'https://api.fingerprint.com' })).toThrow(
      ProPlusServerSdkError,
    )
    const sdk = new ProPlusServerSdk({
      baseUrl: 'https://fp.example.ir',
      fetchImpl: async () => {
        throw new Error('offline')
      },
    })
    const components: UnknownComponents = {
      platform: { value: 'Win32', duration: 0 },
    }
    const envelope = adaptGetResultToObservation(syntheticGetResult(components), {
      purpose: 'lab',
      consentStatus: 'granted',
    })
    await expect(sdk.identify(envelope)).rejects.toMatchObject({ code: 'network_unavailable' })
    expect(placeholderUnknownServerVisitor().matchType).toBe('unknown')
  })

  it('dashboard client stays local-health without management API', () => {
    const client = new ProPlusDashboardClient({
      baseUrl: 'https://admin.example.com',
      accessToken: 'lab-token',
    })
    const health = client.describeLocalHealth()
    expect(health.apiStatus).toBe('unavailable')
    expect(health.productLabel).toContain('Night Watch')
    expect(health.productLabel.toLowerCase()).not.toContain('fingerprint pro')
  })
})
