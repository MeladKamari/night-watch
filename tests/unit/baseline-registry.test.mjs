/**
 * Step 01 — registry lock verification (no entropy collectors).
 * Run with: node --test tests/unit/baseline-registry.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

const expected = readJson('tests/fixtures/expected_enabled_sources.json')
const iranProfile = readJson('reference/default_profile.json')
const inventory = readJson('reference/source_inventory.json')
const upstream42 = readJson('reference/upstream_registry_42.json')

describe('default-v1 registry lock', () => {
  it('enables exactly 41 sources', () => {
    assert.equal(expected.length, 41)
    assert.equal(iranProfile.enabled_source_count, 41)
    assert.equal(iranProfile.enabled_sources.length, 41)
    assert.equal(inventory.length, 41)
  })

  it('excludes applePay and records upstream count 42', () => {
    assert.deepEqual(iranProfile.excluded_sources, ['applePay'])
    assert.equal(iranProfile.upstream_source_count, 42)
    assert.equal(upstream42.count, 42)
    assert.ok(!expected.includes('applePay'))
    assert.ok(!iranProfile.enabled_sources.includes('applePay'))
    assert.ok(!inventory.some((row) => row.name === 'applePay'))
  })

  it('matches fixture, profile, and inventory names in order', () => {
    assert.deepEqual(iranProfile.enabled_sources, expected)
    assert.deepEqual(
      inventory.map((row) => row.name),
      expected,
    )
    for (const [index, row] of inventory.entries()) {
      assert.equal(row.order, index + 1)
    }
  })

  it('preserves relative upstream order after deleting applePay', () => {
    const filteredUpstream = upstream42.sources
      .filter((row) => row.name !== 'applePay')
      .map((row) => row.name)
    assert.deepEqual(filteredUpstream, expected)
  })

  it('marks raw upstream visitorId equality as false', () => {
    assert.equal(iranProfile.compatibility.raw_upstream_visitor_id_equal, false)
    assert.equal(iranProfile.compatibility.filtered_hash_comparison, true)
    assert.equal(iranProfile.default_runtime_network_requests, false)
    assert.equal(iranProfile.name, 'default-v1')
  })

  it('uses unique source names only', () => {
    assert.equal(new Set(expected).size, expected.length)
  })

  it('places webGlBasics and webGlExtensions last', () => {
    assert.equal(expected[39], 'webGlBasics')
    assert.equal(expected[40], 'webGlExtensions')
  })

  it('keeps privateClickMeasurement and omits only applePay between architecture and PCM', () => {
    const architectureIndex = expected.indexOf('architecture')
    const pcmIndex = expected.indexOf('privateClickMeasurement')
    assert.equal(pcmIndex, architectureIndex + 1)
    const upstreamApple = upstream42.sources.find((row) => row.name === 'applePay')
    assert.ok(upstreamApple)
    assert.equal(upstreamApple.order, 37)
    assert.equal(upstreamApple.excluded_from_iran_default_v1, true)
  })

  it('pins inventory URLs to tag v5.3.0', () => {
    for (const row of inventory) {
      assert.match(row.url, /\/fingerprintjs\/blob\/v5\.3\.0\/src\/sources\//)
      assert.equal(typeof row.upstream_file, 'string')
      assert.ok(row.upstream_file.endsWith('.ts'))
      assert.equal(typeof row.cursor_step, 'number')
      assert.ok(row.cursor_step >= 13 && row.cursor_step <= 53)
    }
  })

  it('records pin commit in upstream_registry_42.json', () => {
    assert.equal(upstream42.commit, 'dac5ae59409669f09aa09c0b2f44b7615b0520da')
    assert.equal(upstream42.reference, 'fingerprintjs/fingerprintjs@v5.3.0')
  })
})
