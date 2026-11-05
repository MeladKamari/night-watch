import { describe, expect, it } from 'vitest'
import {
  createNightWatchClient,
  identify,
  VANILLA_PACKAGE_NAME,
} from '@night-watch/vanilla'
import { REACT_PACKAGE_NAME } from '@night-watch/react'
import { VUE_PACKAGE_NAME } from '@night-watch/vue'
import { PREACT_PACKAGE_NAME } from '@night-watch/preact'
import { ANGULAR_PACKAGE_NAME } from '@night-watch/angular'
import {
  BLAZOR_PACKAGE_NAME,
  identifyForBlazor,
  installNightWatchBlazorGlobal,
} from '@night-watch/blazor'
import { ENABLED_SOURCES } from '@night-watch/browser-sdk'

function stubSources() {
  return Object.fromEntries(ENABLED_SOURCES.map((name) => [name, () => ({ ok: name })]))
}

describe('framework binding packages', () => {
  it('exports stable package names', () => {
    expect(VANILLA_PACKAGE_NAME).toBe('@night-watch/vanilla')
    expect(REACT_PACKAGE_NAME).toBe('@night-watch/react')
    expect(VUE_PACKAGE_NAME).toBe('@night-watch/vue')
    expect(PREACT_PACKAGE_NAME).toBe('@night-watch/preact')
    expect(ANGULAR_PACKAGE_NAME).toBe('@night-watch/angular')
    expect(BLAZOR_PACKAGE_NAME).toBe('@night-watch/blazor')
  })

  it('vanilla identify works with allowNonBrowser stubs', async () => {
    const result = await identify({
      allowNonBrowser: true,
      sources: stubSources() as never,
    })
    expect(result.visitorId).toMatch(/^[a-f0-9]{32}$/)
    expect(result.version).toBeTruthy()
  })

  it('vanilla client caches and clears', async () => {
    const client = createNightWatchClient({
      allowNonBrowser: true,
      sources: stubSources() as never,
    })

    expect(client.getSnapshot().status).toBe('idle')
    const a = await client.identify()
    const b = await client.identify()
    expect(a.visitorId).toBe(b.visitorId)
    expect(client.getSnapshot().status).toBe('ready')
    client.clear()
    expect(client.getSnapshot().status).toBe('idle')
  })

  it('blazor interop returns JSON-safe payload', async () => {
    const payload = await identifyForBlazor({
      allowNonBrowser: true,
      sources: stubSources() as never,
    })
    expect(payload.visitorId).toMatch(/^[a-f0-9]{32}$/)
    expect(typeof payload.version).toBe('string')
    expect(payload.confidenceScore === null || typeof payload.confidenceScore === 'number').toBe(
      true,
    )
    installNightWatchBlazorGlobal()
  })
})
