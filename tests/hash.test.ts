import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ENABLED_SOURCES,
  COMPONENT_ERROR_HASH_SENTINEL,
  componentsToCanonicalString,
  getUTF8Bytes,
  hashComponents,
  hashComponentsOmittingExcluded,
  omitExcludedUpstreamComponents,
  x64hash128,
  type UnknownComponents,
} from '@night-watch/core'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const golden = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/hash-golden-vectors.json'), 'utf8'),
) as {
  x64hash128: Array<{ input: string; seed: number; hash: string }>
  componentsSample: { canonical: string; hash: string }
  componentsErrorNull: { canonical: string; hash: string }
  identitySourcesSelfHash: { hash: string }
}

describe('getUTF8Bytes', () => {
  it('encodes ASCII without TextEncoder path length surprises', () => {
    expect([...getUTF8Bytes('ABC')]).toEqual([65, 66, 67])
  })

  it('encodes non-ASCII with TextEncoder', () => {
    expect(getUTF8Bytes('café').length).toBe(5)
    expect(getUTF8Bytes('سلام').length).toBeGreaterThan(4)
  })
})

describe('x64hash128 golden vectors', () => {
  for (const vector of golden.x64hash128) {
    it(`hashes ${JSON.stringify(vector.input)} seed=${vector.seed}`, () => {
      expect(x64hash128(vector.input, vector.seed)).toBe(vector.hash)
    })
  }
})

describe('componentsToCanonicalString', () => {
  it('sorts keys and ignores insertion order / duration', () => {
    const a: UnknownComponents = {
      b: { value: 1, duration: 9 },
      a: { value: 'x', duration: 1 },
    }
    const b: UnknownComponents = {
      a: { value: 'x', duration: 99 },
      b: { value: 1, duration: 0 },
    }
    expect(componentsToCanonicalString(a)).toBe(golden.componentsSample.canonical)
    expect(componentsToCanonicalString(a)).toBe(componentsToCanonicalString(b))
    expect(hashComponents(a)).toBe(golden.componentsSample.hash)
    expect(hashComponents(a)).toBe(hashComponents(b))
  })

  it('escapes : | \\ in keys', () => {
    expect(componentsToCanonicalString({ 'a:b|c': { value: true, duration: 0 } })).toBe(
      'a\\:b\\|c:true',
    )
    expect(
      componentsToCanonicalString({ 'x\\y': { value: 1, duration: 0 } }),
    ).toBe('x\\\\y:1')
  })

  it('uses literal error sentinel and JSON null for NaN', () => {
    const components: UnknownComponents = {
      z: { error: new Error('secret'), duration: 1 },
      a: { value: null, duration: 0 },
      n: { value: Number.NaN, duration: 2 },
    }
    const canonical = componentsToCanonicalString(components)
    expect(canonical).toContain(`z:${COMPONENT_ERROR_HASH_SENTINEL}`)
    expect(canonical).toContain('a:null')
    expect(canonical).toContain('n:null')
    expect(canonical).not.toContain('secret')
    expect(hashComponents({ a: { value: null, duration: 0 }, z: { error: new Error('e'), duration: 1 } })).toBe(
      golden.componentsErrorNull.hash,
    )
  })

  it('stringifies top-level undefined as the undefined token in the template', () => {
    // JSON.stringify(undefined) is undefined; template coercion yields "undefined".
    expect(componentsToCanonicalString({ u: { value: undefined, duration: 0 } })).toBe(
      'u:undefined',
    )
  })
})

describe('default-v1 hashing / filtered upstream', () => {
  it('golden hash for 41 identity-named source values', () => {
    const components: UnknownComponents = {}
    for (const name of ENABLED_SOURCES) {
      components[name] = { value: name, duration: 1 }
    }
    expect(Object.keys(components)).toHaveLength(41)
    expect(hashComponents(components)).toBe(golden.identitySourcesSelfHash.hash)
  })

  it('omits applePay before hashing for filtered parity', () => {
    const withApple: UnknownComponents = {
      platform: { value: 'Win32', duration: 1 },
      applePay: { value: 1, duration: 1 },
      timezone: { value: 'Asia/Tehran', duration: 1 },
    }
    const filtered = omitExcludedUpstreamComponents(withApple)
    expect(filtered).not.toHaveProperty('applePay')
    expect(Object.keys(filtered).sort()).toEqual(['platform', 'timezone'])

    const hashFiltered = hashComponents(filtered)
    const hashHelper = hashComponentsOmittingExcluded(withApple)
    expect(hashHelper).toBe(hashFiltered)

    const hashWithApple = hashComponents(withApple)
    expect(hashWithApple).not.toBe(hashFiltered)

    // Raw upstream visitorId equality is not a goal — demonstrate inequality explicitly.
    expect(hashWithApple).not.toBe(hashHelper)
  })

  it('does not treat 42-source map as default-profile visitor id', () => {
    const fortyOne: UnknownComponents = {}
    for (const name of ENABLED_SOURCES) {
      fortyOne[name] = { value: true, duration: 0 }
    }
    const fortyTwo: UnknownComponents = {
      ...fortyOne,
      applePay: { value: -1, duration: 0 },
    }
    expect(hashComponents(fortyOne)).not.toBe(hashComponents(fortyTwo))
    expect(hashComponentsOmittingExcluded(fortyTwo)).toBe(hashComponents(fortyOne))
  })
})
