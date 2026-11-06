import {
  componentsToCanonicalString,
  createBuiltinSources,
  getTimezone,
  getTimezoneOffsetMinutes,
  getTimezoneValue,
  hashComponents,
  isValueComponent,
  load,
  type OffsetDateCtor,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

function mockIntlWithTimeZone(timeZone: string | undefined): typeof Intl {
  return {
    DateTimeFormat: class {
      resolvedOptions() {
        return { timeZone }
      }
    },
  } as unknown as typeof Intl
}

function mockDateWithOffsets(januaryOffset: number, julyOffset: number) {
  return class MockDate {
    args: unknown[]
    constructor(...args: unknown[]) {
      this.args = args
    }
    getFullYear() {
      return 2024
    }
    getTimezoneOffset() {
      if (this.args.length === 0) {
        return 0
      }
      if (this.args[1] === 0) {
        return januaryOffset
      }
      if (this.args[1] === 6) {
        return julyOffset
      }
      throw new TypeError('Unexpected constructor arguments')
    }
  } as unknown as OffsetDateCtor
}

describe('getTimezoneValue', () => {
  it('prefers IANA names including Asia/Tehran, Asia/Dubai, UTC (never invents them)', () => {
    expect(getTimezoneValue({ Intl: mockIntlWithTimeZone('Asia/Tehran') })).toBe('Asia/Tehran')
    expect(getTimezoneValue({ Intl: mockIntlWithTimeZone('Asia/Dubai') })).toBe('Asia/Dubai')
    expect(getTimezoneValue({ Intl: mockIntlWithTimeZone('UTC') })).toBe('UTC')
  })

  it('does not hardcode Asia/Tehran when Intl is denied', () => {
    const value = getTimezoneValue({
      Intl: null,
      DateCtor: mockDateWithOffsets(0, 0),
    })
    expect(value).toBe('UTC+0')
    expect(value).not.toBe('Asia/Tehran')
  })

  it('DST-stable fallback: northern east (Berlin) and southern west (Santiago)', () => {
    expect(
      getTimezoneValue({
        Intl: null,
        DateCtor: mockDateWithOffsets(1 * -60, 2 * -60),
      }),
    ).toBe('UTC+60')
    expect(
      getTimezoneValue({
        Intl: null,
        DateCtor: mockDateWithOffsets(-3 * -60, -4 * -60),
      }),
    ).toBe('UTC-240')
  })

  it('half-hour zone fallback (Tehran-like +03:30 → UTC+210)', () => {
    expect(
      getTimezoneValue({
        Intl: null,
        DateCtor: mockDateWithOffsets(-210, -210),
      }),
    ).toBe('UTC+210')
  })

  it('falls back when timeZone missing/empty', () => {
    expect(
      getTimezoneValue({
        Intl: mockIntlWithTimeZone(undefined),
        DateCtor: mockDateWithOffsets(0, 0),
      }),
    ).toBe('UTC+0')
    expect(
      getTimezoneValue({
        Intl: mockIntlWithTimeZone(''),
        DateCtor: mockDateWithOffsets(0, 0),
      }),
    ).toBe('UTC+0')
  })

  it('getTimezoneOffsetMinutes takes max of Jan/July (DST season)', () => {
    expect(getTimezoneOffsetMinutes(mockDateWithOffsets(-60, -120))).toBe(-60)
    expect(getTimezoneOffsetMinutes(mockDateWithOffsets(180, 240))).toBe(240)
  })

  it('Node with real Intl returns a non-empty string (no geo hardcoding)', () => {
    const value = getTimezoneValue()
    expect(typeof value).toBe('string')
    expect(value.length).toBeGreaterThan(0)
  })
})


describe('builtin timezone wiring', () => {
  it('wires timezone as source #14', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[13]).toBe('timezone')
    expect(sources.timezone).toBe(getTimezone)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.timezone)).toBe(true)
    if (isValueComponent(result.components.timezone)) {
      expect(typeof result.components.timezone.value).toBe('string')
      expect(String(result.components.timezone.value).length).toBeGreaterThan(0)
    }

    expect(
      componentsToCanonicalString({
        timezone: { value: 'Asia/Tehran', duration: 1 },
      }),
    ).toContain('timezone:')
    expect(
      hashComponents({
        timezone: { value: 'UTC', duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
