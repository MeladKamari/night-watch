import {
  componentsToCanonicalString,
  createBuiltinSources,
  getVendor,
  getVendorValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readVendor,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readVendor / getVendorValue', () => {
  it('returns Chromium / Safari vendor strings when present', () => {
    expect(readVendor({ vendor: 'Google Inc.' })).toBe('Google Inc.')
    expect(getVendorValue({ navigator: { vendor: 'Apple Computer, Inc.' } })).toBe(
      'Apple Computer, Inc.',
    )
  })

  it('empty / undefined / missing → empty string (never invents a brand)', () => {
    expect(readVendor({ vendor: '' })).toBe('')
    expect(readVendor({})).toBe('')
    expect(readVendor({ vendor: undefined })).toBe('')
    expect(readVendor(null)).toBe('')
    expect(getVendorValue({ navigator: null })).toBe('')
    expect(getVendorValue()).toBe('')
  })

  it('does not invent vendor from userAgent', () => {
    expect(
      readVendor({
        vendor: '',
      } as { vendor?: string; userAgent?: string }),
    ).toBe('')
  })

  it('repeated calls are deterministic for fixed injects', () => {
    const nav = { vendor: 'Google Inc.' }
    expect(getVendorValue({ navigator: nav })).toBe(getVendorValue({ navigator: nav }))
  })

  it('surfaces vendor getter throws to loadSource error path', async () => {
    const hostile = {} as { vendor?: string }
    Object.defineProperty(hostile, 'vendor', {
      get() {
        throw new Error('vendor blocked')
      },
      configurable: true,
    })
    expect(() => getVendorValue({ navigator: hostile })).toThrow('vendor blocked')

    const source: Source<BuiltinSourceOptions, string> = () =>
      getVendorValue({ navigator: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin vendor wiring', () => {
  it('wires vendor as source #23; Node yields empty string', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[22]).toBe('vendor')
    expect(sources.vendor).toBe(getVendor)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.vendor)).toBe(true)
    if (isValueComponent(result.components.vendor)) {
      expect(result.components.vendor.value).toBe('')
    }

    expect(
      componentsToCanonicalString({
        vendor: { value: 'Google Inc.', duration: 1 },
      }),
    ).toContain('vendor:')
    expect(
      hashComponents({
        vendor: { value: '', duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
