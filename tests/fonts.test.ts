import {
  FONT_BASE_FAMILIES,
  FONT_CANDIDATE_LIST,
  FONT_PROBE_STRING,
  UnsupportedEnvironmentError,
  componentsToCanonicalString,
  createBuiltinSources,
  getFonts,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  probeFontsInDocument,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

/**
 * Minimal document fixture: offsetWidth/Height driven by fontFamily string.
 * Base families use fixed sizes; a "detected" font changes size when listed first in the stack.
 */
function createFontProbeDocument(opts: {
  baseSizes: Record<string, { width: number; height: number }>
  /** Candidate fonts that should report different metrics vs their base fallback. */
  available: ReadonlySet<string>
}): Document {
  const body = {
    style: { fontSize: '' },
    appendChild(node: unknown) {
      return node
    },
  }

  const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, '')

  const createElement = (tag: string) => {
    if (tag === 'div') {
      return {
        style: {
          setProperty() {
            /* noop */
          },
        },
        appendChild(child: unknown) {
          return child
        },
      }
    }
    if (tag === 'span') {
      const style: { fontFamily: string; position?: string; top?: string; left?: string } = {
        fontFamily: '',
      }
      return {
        style,
        textContent: '',
        get offsetWidth() {
          return measure(style.fontFamily).width
        },
        get offsetHeight() {
          return measure(style.fontFamily).height
        },
      }
    }
    throw new Error(`unexpected tag ${tag}`)
  }

  function measure(fontFamily: string): { width: number; height: number } {
    const parts = fontFamily.split(',').map((p) => stripQuotes(p.trim()))
    const primary = parts[0] ?? ''
    const base = parts[1]

    // Candidate + base stack: installed fonts change metrics; missing fonts match the base.
    if (base) {
      const baseSize = opts.baseSizes[base] ?? { width: 10, height: 10 }
      if (opts.available.has(primary)) {
        return { width: baseSize.width + 7, height: baseSize.height + 3 }
      }
      return baseSize
    }

    if (opts.baseSizes[primary]) {
      return opts.baseSizes[primary]!
    }

    return { width: 10, height: 10 }
  }

  return {
    body,
    createElement,
  } as unknown as Document
}

describe('FONT_CANDIDATE_LIST (Default-profile)', () => {
  it('matches pinned upstream count and excludes Persian opt-in names', () => {
    expect(FONT_CANDIDATE_LIST).toHaveLength(52)
    expect(FONT_CANDIDATE_LIST).toContain('Calibri')
    expect(FONT_CANDIDATE_LIST).toContain('Arabic Typesetting')
    expect(FONT_CANDIDATE_LIST).not.toContain('Vazirmatn')
    expect(FONT_CANDIDATE_LIST).not.toContain('B Nazanin')
    expect(FONT_PROBE_STRING).toBe('mmMwWLliI0O&1')
    expect(FONT_BASE_FAMILIES).toEqual(['monospace', 'sans-serif', 'serif'])
  })
})

describe('probeFontsInDocument', () => {
  const baseSizes = {
    monospace: { width: 100, height: 20 },
    'sans-serif': { width: 90, height: 22 },
    serif: { width: 95, height: 21 },
  }

  it('returns only fonts whose metrics differ from all-base matches', () => {
    const doc = createFontProbeDocument({
      baseSizes,
      available: new Set(['Calibri', 'Menlo']),
    })
    const found = probeFontsInDocument(doc, {
      fontList: ['Calibri', 'MissingFont', 'Menlo'],
      baseFonts: FONT_BASE_FAMILIES,
    })
    expect(found).toEqual(['Calibri', 'Menlo'])
  })

  it('returns empty when every candidate matches base metrics (missing fonts)', () => {
    const doc = createFontProbeDocument({
      baseSizes,
      available: new Set(),
    })
    expect(
      probeFontsInDocument(doc, {
        fontList: ['Calibri', 'Menlo'],
        baseFonts: FONT_BASE_FAMILIES,
      }),
    ).toEqual([])
  })

  it('treats same glyph width as unavailable when all bases match', () => {
    // Force all spans to identical size regardless of family
    const flatDoc = {
      body: {
        style: { fontSize: '' },
        appendChild(n: unknown) {
          return n
        },
      },
      createElement(tag: string) {
        if (tag === 'div') {
          return {
            style: { setProperty() {} },
            appendChild(c: unknown) {
              return c
            },
          }
        }
        return {
          style: { fontFamily: '', position: '', top: '', left: '' },
          textContent: '',
          offsetWidth: 50,
          offsetHeight: 50,
        }
      },
    } as unknown as Document

    expect(
      probeFontsInDocument(flatDoc, {
        fontList: ['Calibri'],
        baseFonts: ['monospace', 'sans-serif', 'serif'],
      }),
    ).toEqual([])
  })

  it('preserves candidate list order in the result', () => {
    const doc = createFontProbeDocument({
      baseSizes,
      available: new Set(['Menlo', 'Calibri']),
    })
    expect(
      probeFontsInDocument(doc, {
        fontList: ['Menlo', 'Calibri'],
        baseFonts: FONT_BASE_FAMILIES,
      }),
    ).toEqual(['Menlo', 'Calibri'])
  })

  it('throws when document.body is missing', () => {
    expect(() =>
      probeFontsInDocument({ body: null, createElement: () => ({}) } as unknown as Document),
    ).toThrow(/document\.body/)
  })
})

describe('getFonts / registry', () => {
  it('rejects under Node (no silent empty default)', async () => {
    await expect(getFonts({ cache: {} })).rejects.toBeInstanceOf(UnsupportedEnvironmentError)
  })

  it('wires fonts into builtin sources; Node load records error not fabricated []', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[1]).toBe('fonts')

    const agent = await load({
      delayFallback: 0,
      sources,
      allowNonBrowser: true,
    })
    const result = await agent.get()
    expect(isErrorComponent(result.components.fonts)).toBe(true)
    if (isErrorComponent(result.components.fonts)) {
      expect(result.components.fonts.error).toBeInstanceOf(UnsupportedEnvironmentError)
    }
    expect(isValueComponent(result.components.userAgentData)).toBe(true)
  })

  it('hashes detected font lists deterministically', () => {
    const components = {
      fonts: { value: ['Calibri', 'Menlo'], duration: 1 },
    }
    expect(componentsToCanonicalString(components)).toBe('fonts:["Calibri","Menlo"]')
    expect(hashComponents(components)).toMatch(/^[0-9a-f]{32}$/)
    expect(hashComponents(components)).toBe(hashComponents(components))
  })
})
