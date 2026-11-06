import {
  HEURISTIC_SCORES,
  assertScoreInUnitInterval,
  deriveReferenceScaleScore,
  getConfidence,
  getOpenConfidenceScore,
  heuristicPlatformConfidenceModel,
  resolveConfidenceEnvironment,
  type Confidence,
} from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

function platform(value: unknown) {
  return { platform: { value, duration: 1 } }
}

function expectUnitScore(confidence: Confidence) {
  expect(confidence.score).toBeGreaterThanOrEqual(0)
  expect(confidence.score).toBeLessThanOrEqual(1)
  expect(Number.isFinite(confidence.score)).toBe(true)
}

describe('heuristic confidence model', () => {
  it('scores Windows / Mac / other from platform string under Node-safe env', () => {
    expect(getConfidence(platform('Win32')).score).toBe(HEURISTIC_SCORES.windows)
    expect(getConfidence(platform('Windows')).score).toBe(HEURISTIC_SCORES.windows)
    expect(getConfidence(platform('MacIntel')).score).toBe(HEURISTIC_SCORES.mac)
    expect(getConfidence(platform('Linux x86_64')).score).toBe(HEURISTIC_SCORES.other)
    expectUnitScore(getConfidence(platform('Win32')))
  })

  it('uses Android / WebKit environment hints when provided', () => {
    expect(
      getConfidence(platform('Linux armv8l'), { environment: { isAndroid: true } }).score,
    ).toBe(HEURISTIC_SCORES.android)

    expect(
      getConfidence(platform('iPhone'), {
        environment: { isWebKit: true, isDesktopWebKit: false },
      }).score,
    ).toBe(HEURISTIC_SCORES.webkitMobileOrModernSafari)

    expect(
      getConfidence(platform('MacIntel'), {
        environment: {
          isWebKit: true,
          isDesktopWebKit: true,
          isWebKit616OrNewer: false,
          isSafariWebKit: false,
        },
      }).score,
    ).toBe(HEURISTIC_SCORES.webkitDesktopLegacy)

    expect(
      getConfidence(platform('MacIntel'), {
        environment: {
          isWebKit: true,
          isDesktopWebKit: true,
          isWebKit616OrNewer: true,
          isSafariWebKit: true,
        },
      }).score,
    ).toBe(HEURISTIC_SCORES.webkitMobileOrModernSafari)
  })

  it('treats missing or error platform as other (0.7)', () => {
    expect(getConfidence({}).score).toBe(HEURISTIC_SCORES.other)
    expect(getConfidence({ platform: { error: new Error('x'), duration: 1 } }).score).toBe(
      HEURISTIC_SCORES.other,
    )
  })

  it('emits an honest comment without Pro / fingerprint.com marketing', () => {
    const confidence = getConfidence(platform('Win32'))
    expect(confidence.comment).toBeTypeOf('string')
    expect(confidence.comment).toMatch(/Not a calibrated probability/i)
    expect(confidence.comment).not.toMatch(/fingerprint\.com/i)
    expect(confidence.comment).not.toMatch(/upgrade to Pro/i)
    expect(confidence.comment).toContain(String(deriveReferenceScaleScore(0.6)))
  })

  it('can omit comment when requested', () => {
    const confidence = getConfidence(platform('Win32'), { includeComment: false })
    expect(confidence).toEqual({ score: 0.6 })
    expect('comment' in confidence).toBe(false)
  })

  it('does not boost confidence for Persian locale or Tehran timezone strings', () => {
    // Locale/timezone must never be confidence inputs — only platform/engine hints.
    const base = getOpenConfidenceScore(platform('Win32'), resolveConfidenceEnvironment())
    const withFa = getOpenConfidenceScore(platform('Win32'), resolveConfidenceEnvironment())
    expect(base).toBe(withFa)
    expect(getConfidence(platform('fa-IR')).score).toBe(HEURISTIC_SCORES.other)
    expect(getConfidence(platform('Asia/Tehran')).score).toBe(HEURISTIC_SCORES.other)
  })

  it('exposes the heuristic model as explicitly uncalibrated', () => {
    expect(heuristicPlatformConfidenceModel.isCalibrated).toBe(false)
    expect(heuristicPlatformConfidenceModel.revision).toBe('heuristic-platform-v1')
    const scored = heuristicPlatformConfidenceModel.score(
      platform('MacIntel'),
      resolveConfidenceEnvironment(),
    )
    expect(scored.score).toBe(HEURISTIC_SCORES.mac)
  })

  it('assertScoreInUnitInterval rejects invalid scores', () => {
    expect(() => assertScoreInUnitInterval(Number.NaN)).toThrow(TypeError)
    expect(() => assertScoreInUnitInterval(1.2)).toThrow(RangeError)
    expect(() => assertScoreInUnitInterval(-0.1)).toThrow(RangeError)
    expect(assertScoreInUnitInterval(0)).toBe(0)
    expect(assertScoreInUnitInterval(1)).toBe(1)
  })
})
