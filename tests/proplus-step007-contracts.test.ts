import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertPayloadSize,
  validateErrorEnvelope,
  validateIdentificationEvent,
  validateObservation,
} from '@night-watch/contracts'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = join(root, 'tests/fixtures/proplus')

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'))
}

describe('STEP 007 contracts and event versioning', () => {
  it('accepts backward-compatible valid fixtures', () => {
    expect(validateObservation(readJson('observation.valid.json'))).toEqual({ ok: true })
    expect(validateIdentificationEvent(readJson('event.valid.json'))).toEqual({ ok: true })
  })

  it('rejects unexpected fields, malformed arrays, invalid timestamps, oversized payloads', () => {
    const obs = readJson('observation.valid.json') as Record<string, unknown>
    expect(validateObservation({ ...obs, evil: true }).ok).toBe(false)

    const badTs = { ...obs, collectedAt: '03/11/2026' }
    expect(validateObservation(badTs).ok).toBe(false)

    const legacy = { ...(obs.legacyBrowser as Record<string, unknown>) }
    legacy.componentKeys = [1, 2]
    expect(validateObservation({ ...obs, legacyBrowser: legacy }).ok).toBe(false)

    legacy.componentKeys = Array.from({ length: 65 }, (_, i) => `s${i}`)
    expect(validateObservation({ ...obs, legacyBrowser: legacy }).ok).toBe(false)

    legacy.componentKeys = ['applePay']
    expect(validateObservation({ ...obs, legacyBrowser: legacy }).ok).toBe(false)

    const huge = 'x'.repeat(300 * 1024)
    expect(assertPayloadSize(huge).ok).toBe(false)
  })

  it('error envelope validates problem+json shape', () => {
    expect(
      validateErrorEnvelope({
        type: 'https://night-watch.local/problems/validation',
        title: 'Validation failed',
        status: 400,
        code: 'validation_error',
      }),
    ).toEqual({ ok: true })
    expect(validateErrorEnvelope({ title: 'x', status: 200, code: 'x', type: 'y' }).ok).toBe(false)
  })

  it('publishes openapi and schema files', () => {
    for (const rel of [
      'contracts/openapi/v1/openapi.yaml',
      'contracts/schemas/observation.schema.json',
      'contracts/schemas/identification-event.schema.json',
      'contracts/schemas/signal-evaluation.schema.json',
      'contracts/schemas/risk-decision.schema.json',
      'contracts/schemas/server-receipt.schema.json',
      'contracts/schemas/error-envelope.schema.json',
    ]) {
      expect(readFileSync(join(root, rel), 'utf8').length).toBeGreaterThan(20)
    }
  })
})
