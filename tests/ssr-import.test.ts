import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * Proves package entrypoints are SSR-safe: importing under Node must not
 * touch browser globals or throw.
 */
describe('SSR-safe package imports', () => {
  it('imports @night-watch/core under Node without DOM access', async () => {
    const core = await import('@night-watch/core')
    expect(core.SOURCE_MANIFEST_REVISION).toBe('default-v1')
    expect(core.ENABLED_SOURCE_COUNT).toBe(41)
    expect(core.ENABLED_SOURCES).not.toContain('applePay')
    expect(core.EXCLUDED_UPSTREAM_SOURCE).toBe('applePay')
    expect(() => core.assertDefaultRegistryInvariants()).not.toThrow()
    // Runtime module must be import-safe; probes run only when called.
    expect(core.isBrowserEnvironment()).toBe(false)
    expect(core.getWindow().status).toBe('unsupported')
    // Browser detectors must stay false under Node (no top-level DOM access).
    expect(core.isChromium()).toBe(false)
    expect(core.isWebKit()).toBe(false)
    expect(core.detectConfidenceEnvironmentHints().isWebKit).toBe(false)
    expect(core.isInIframe()).toBe(false)
    await expect(core.withIframe(async () => 0)).rejects.toBeInstanceOf(core.UnsupportedEnvironmentError)
    // Scheduler helpers are import-safe and usable under Node.
    await expect(core.releaseEventLoop()).resolves.toBeUndefined()
    await expect(core.requestIdleCallbackIfAvailable(1, 1)).resolves.toBeUndefined()
  })

  it('imports @night-watch/browser-sdk under Node without DOM access', async () => {
    const sdk = await import('@night-watch/browser-sdk')
    expect(sdk.SDK_PACKAGE_NAME).toBe('@night-watch/browser-sdk')
    expect(sdk.SDK_PACKAGE_VERSION).toBe('1.0.0')
    expect(sdk.SOURCE_MANIFEST_REVISION).toBe('default-v1')
    expect(sdk.listEnabledSources()).toHaveLength(41)
    expect(sdk.isExcludedUpstreamSource('applePay')).toBe(true)
  })

  it('resolves package.json sideEffects false for tree-shaking intent', () => {
    const require = createRequire(import.meta.url)
    const corePkg = require('../packages/core/package.json') as { sideEffects: boolean }
    const sdkPkg = require('../packages/browser-sdk/package.json') as { sideEffects: boolean }
    expect(corePkg.sideEffects).toBe(false)
    expect(sdkPkg.sideEffects).toBe(false)
  })
})
