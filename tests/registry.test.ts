import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ENABLED_SOURCES,
  ENABLED_SOURCE_COUNT,
  EXCLUDED_UPSTREAM_SOURCE,
  RegistryInvariantError,
  SOURCE_MANIFEST_REVISION,
  UPSTREAM_PIN,
  UPSTREAM_SOURCE_COUNT,
  assertDefaultRegistryInvariants,
  listEnabledSources,
} from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as T
}

describe('default-v1 registry (packages/core)', () => {
  const expected = readJson<string[]>('tests/fixtures/expected_enabled_sources.json')
  const iranProfile = readJson<{
    name: string
    enabled_sources: string[]
    excluded_sources: string[]
    compatibility: { raw_upstream_visitor_id_equal: boolean }
  }>('reference/default_profile.json')
  const upstream42 = readJson<{
    sources: Array<{ name: string }>
    commit: string
  }>('reference/upstream_registry_42.json')

  it('locks count, exclusion, and manifest revision', () => {
    expect(ENABLED_SOURCE_COUNT).toBe(41)
    expect(UPSTREAM_SOURCE_COUNT).toBe(42)
    expect(SOURCE_MANIFEST_REVISION).toBe('default-v1')
    expect(EXCLUDED_UPSTREAM_SOURCE).toBe('applePay')
    expect(ENABLED_SOURCES).toEqual(expected)
    expect(iranProfile.enabled_sources).toEqual([...ENABLED_SOURCES])
    expect(iranProfile.excluded_sources).toEqual(['applePay'])
    expect(iranProfile.compatibility.raw_upstream_visitor_id_equal).toBe(false)
  })

  it('preserves relative upstream order after deleting applePay', () => {
    const filtered = upstream42.sources
      .filter((row) => row.name !== 'applePay')
      .map((row) => row.name)
    expect(filtered).toEqual([...ENABLED_SOURCES])
  })

  it('pins upstream commit metadata', () => {
    expect(UPSTREAM_PIN.commit).toBe('dac5ae59409669f09aa09c0b2f44b7615b0520da')
    expect(UPSTREAM_PIN.tag).toBe('v5.3.0')
    expect(upstream42.commit).toBe(UPSTREAM_PIN.commit)
  })

  it('assertDefaultRegistryInvariants accepts the locked list', () => {
    expect(() => assertDefaultRegistryInvariants()).not.toThrow()
    expect(listEnabledSources()).toEqual([...ENABLED_SOURCES])
    expect(listEnabledSources()).not.toBe(ENABLED_SOURCES)
  })

  it('assertDefaultRegistryInvariants rejects applePay and wrong length', () => {
    expect(() => assertDefaultRegistryInvariants([...ENABLED_SOURCES, 'applePay'])).toThrow(
      RegistryInvariantError,
    )
    expect(() => assertDefaultRegistryInvariants(ENABLED_SOURCES.slice(0, 40))).toThrow(
      RegistryInvariantError,
    )
  })
})
