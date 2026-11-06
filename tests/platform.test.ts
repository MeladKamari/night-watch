import {
  componentsToCanonicalString,
  createBuiltinSources,
  getPlatform,
  getPlatformValue,
  hashComponents,
  isValueComponent,
  load,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

describe('getPlatformValue', () => {
  it('passes through Windows / Linux / Android / macOS desktop strings', () => {
    expect(getPlatformValue({ navigator: { platform: 'Win32' } })).toBe('Win32')
    expect(getPlatformValue({ navigator: { platform: 'Win64' } })).toBe('Win64')
    expect(getPlatformValue({ navigator: { platform: 'Linux x86_64' } })).toBe('Linux x86_64')
    expect(getPlatformValue({ navigator: { platform: 'Linux armv8l' } })).toBe('Linux armv8l')
    expect(getPlatformValue({ navigator: { platform: 'MacIntel' } })).toBe('MacIntel')
  })

  it('remaps MacIntel on mobile WebKit to iPad / iPhone', () => {
    expect(
      getPlatformValue({
        navigator: { platform: 'MacIntel' },
        isWebKit: true,
        isDesktopWebKit: false,
        isIPad: true,
      }),
    ).toBe('iPad')
    expect(
      getPlatformValue({
        navigator: { platform: 'MacIntel' },
        isWebKit: true,
        isDesktopWebKit: false,
        isIPad: false,
      }),
    ).toBe('iPhone')
  })

  it('keeps MacIntel on desktop WebKit (real Mac)', () => {
    expect(
      getPlatformValue({
        navigator: { platform: 'MacIntel' },
        isWebKit: true,
        isDesktopWebKit: true,
        isIPad: false,
      }),
    ).toBe('MacIntel')
  })

  it('does not remap Android desktop-site platform values', () => {
    expect(
      getPlatformValue({
        navigator: { platform: 'Linux armv8l' },
        isWebKit: false,
      }),
    ).toBe('Linux armv8l')
  })

  it('missing property / Node → empty string (no inventing Win32)', () => {
    expect(getPlatformValue({ navigator: {} })).toBe('')
    expect(getPlatformValue({ navigator: null })).toBe('')
    expect(getPlatformValue()).toBe('')
  })
})

describe('builtin platform wiring', () => {
  it('wires platform as source #20', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[19]).toBe('platform')
    expect(sources.platform).toBe(getPlatform)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.platform)).toBe(true)
    if (isValueComponent(result.components.platform)) {
      expect(result.components.platform.value).toBe('')
    }

    expect(
      componentsToCanonicalString({
        platform: { value: 'Win32', duration: 1 },
      }),
    ).toContain('platform:')
    expect(
      hashComponents({
        platform: { value: 'iPhone', duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
