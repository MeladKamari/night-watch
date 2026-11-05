import {
  componentsToCanonicalString,
  createBuiltinSources,
  getPdfViewerEnabled,
  getPdfViewerEnabledValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readPdfViewerEnabled,
} from '@night-watch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('readPdfViewerEnabled / getPdfViewerEnabledValue', () => {
  it('returns true/false when present', () => {
    expect(readPdfViewerEnabled({ pdfViewerEnabled: true })).toBe(true)
    expect(readPdfViewerEnabled({ pdfViewerEnabled: false })).toBe(false)
    expect(getPdfViewerEnabledValue({ navigator: { pdfViewerEnabled: true } })).toBe(true)
    expect(getPdfViewerEnabledValue({ navigator: { pdfViewerEnabled: false } })).toBe(false)
  })

  it('returns undefined when unsupported / absent; never invents false', () => {
    expect(readPdfViewerEnabled({})).toBeUndefined()
    expect(readPdfViewerEnabled(null)).toBeUndefined()
    expect(getPdfViewerEnabledValue({ navigator: null })).toBeUndefined()
    expect(getPdfViewerEnabledValue({ navigator: {} })).toBeUndefined()
    // Node / no navigator → undefined (not false)
    expect(getPdfViewerEnabledValue()).toBeUndefined()
  })

  it('preserves explicit undefined getter (property present, value undefined)', () => {
    const nav = {} as { pdfViewerEnabled?: boolean }
    Object.defineProperty(nav, 'pdfViewerEnabled', {
      get() {
        return undefined
      },
      configurable: true,
    })
    expect(readPdfViewerEnabled(nav)).toBeUndefined()
    expect(getPdfViewerEnabledValue({ navigator: nav })).toBeUndefined()
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as { pdfViewerEnabled?: boolean }
    Object.defineProperty(hostile, 'pdfViewerEnabled', {
      get() {
        throw new Error('pdfViewerEnabled blocked')
      },
      configurable: true,
    })
    expect(() => getPdfViewerEnabledValue({ navigator: hostile })).toThrow(
      'pdfViewerEnabled blocked',
    )

    const source: Source<BuiltinSourceOptions, boolean | undefined> = () =>
      getPdfViewerEnabledValue({ navigator: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin pdfViewerEnabled wiring', () => {
  it('wires pdfViewerEnabled as source #35; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[34]).toBe('pdfViewerEnabled')
    expect(sources.pdfViewerEnabled).toBe(getPdfViewerEnabled)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.pdfViewerEnabled)).toBe(true)
    if (isValueComponent(result.components.pdfViewerEnabled)) {
      expect(result.components.pdfViewerEnabled.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        pdfViewerEnabled: { value: true, duration: 1 },
      }),
    ).toContain('pdfViewerEnabled:')
    expect(
      hashComponents({
        pdfViewerEnabled: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
    // true vs false vs undefined must hash differently
    const hTrue = hashComponents({ pdfViewerEnabled: { value: true, duration: 1 } })
    const hFalse = hashComponents({ pdfViewerEnabled: { value: false, duration: 1 } })
    const hUndef = hashComponents({ pdfViewerEnabled: { value: undefined, duration: 1 } })
    expect(hTrue).not.toBe(hFalse)
    expect(hTrue).not.toBe(hUndef)
    expect(hFalse).not.toBe(hUndef)
  })
})
