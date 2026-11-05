import {
  FONT_PREFERENCES_DEFAULT_TEXT,
  FONT_PREFERENCE_PRESETS,
  UnsupportedEnvironmentError,
  componentsToCanonicalString,
  createBuiltinSources,
  getFontPreferences,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  measureFontPreferencesInContainer,
  normalizeFontMeasurement,
} from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

function createMeasureDocument(widths: Record<string, number>): {
  document: Document
  container: HTMLElement
  hostMutations: number
} {
  let hostMutations = 0
  const children: HTMLElement[] = []

  const makeEl = (tag: string): HTMLElement => {
    const style: Record<string, string> = {}
    let textContent = ''
    const el = {
      tagName: tag.toUpperCase(),
      style: new Proxy(style, {
        get(target, prop: string) {
          if (prop === 'setProperty') {
            return (name: string, value: string) => {
              target[name] = value
            }
          }
          return target[prop]
        },
        set(target, prop: string, value: string) {
          target[prop] = value
          return true
        },
      }),
      get textContent() {
        return textContent
      },
      set textContent(v: string) {
        textContent = v
      },
      append(...nodes: HTMLElement[]) {
        children.push(...nodes)
      },
      appendChild(node: HTMLElement) {
        children.push(node)
        return node
      },
      getBoundingClientRect() {
        // Width keyed by fontFamily / font / fontSize signature in textContent+style
        const family = style.fontFamily || style.font || style.fontSize || 'default'
        const key =
          family === '-apple-system-body'
            ? 'apple'
            : family === 'serif'
              ? 'serif'
              : family === 'sans-serif'
                ? 'sans'
                : family === 'monospace'
                  ? 'mono'
                  : family === '1px'
                    ? 'min'
                    : family === 'system-ui'
                      ? 'system'
                      : textContent === FONT_PREFERENCES_DEFAULT_TEXT && !style.fontFamily && !style.font
                        ? 'default'
                        : 'default'
        return { width: widths[key] ?? 0, height: 10, top: 0, left: 0, right: 0, bottom: 0 }
      },
    }
    return el as unknown as HTMLElement
  }

  const container = makeEl('div')
  const document = {
    createElement(tag: string) {
      return makeEl(tag)
    },
  } as unknown as Document

  // Track accidental host mutation API usage in this fixture (container.append only).
  const originalAppend = container.append.bind(container)
  container.append = (...nodes: HTMLElement[]) => {
    hostMutations += 1
    return originalAppend(...nodes)
  }

  return { document, container, get hostMutations() { return hostMutations } }
}

describe('FONT_PREFERENCE_PRESETS', () => {
  it('locks upstream preset keys and canonical Latin text', () => {
    expect(Object.keys(FONT_PREFERENCE_PRESETS)).toEqual([
      'default',
      'apple',
      'serif',
      'sans',
      'mono',
      'min',
      'system',
    ])
    expect(FONT_PREFERENCES_DEFAULT_TEXT).toBe('mmMwWLliI0fiflO&1')
    // Persian samples must not replace the hashed default text.
    expect(FONT_PREFERENCES_DEFAULT_TEXT).not.toMatch(/[\u0600-\u06FF]/)
  })
})

describe('normalizeFontMeasurement', () => {
  it('floors to 3 decimals off Android; whole pixels on Android', () => {
    expect(normalizeFontMeasurement(12.3456, false)).toBe(12.345)
    expect(normalizeFontMeasurement(12.999, false)).toBe(12.999)
    expect(normalizeFontMeasurement(12.3456, true)).toBe(12)
  })

  it('reverses Chromium zoom via DPR then normalizes', () => {
    const raw = 50
    const dpr = 2
    expect(normalizeFontMeasurement(raw * dpr, false)).toBe(100)
  })
})

describe('measureFontPreferencesInContainer', () => {
  it('returns numeric widths for all presets', () => {
    const widths = {
      default: 120,
      apple: 118,
      serif: 130,
      sans: 125,
      mono: 140,
      min: 3,
      system: 122,
    }
    const { document, container } = createMeasureDocument(widths)
    const result = measureFontPreferencesInContainer(document, container, {
      normalizeForChromium128: false,
    })
    expect(result).toEqual(widths)
  })

  it('applies Chromium128 normalization with DPR', () => {
    const { document, container } = createMeasureDocument({
      default: 50,
      apple: 50,
      serif: 50,
      sans: 50,
      mono: 50,
      min: 50,
      system: 50,
    })
    const result = measureFontPreferencesInContainer(document, container, {
      normalizeForChromium128: true,
      devicePixelRatio: 2,
      isAndroidEnv: false,
    })
    expect(result.default).toBe(100)
  })

  it('can measure Persian fixture text without changing default hashed presets', () => {
    const persian = 'سلام'
    const latin = FONT_PREFERENCES_DEFAULT_TEXT
    expect(persian).toMatch(/[\u0600-\u06FF]/)

    const { document, container } = createMeasureDocument({ default: 99 })
    // Override only in a local presets object — production presets stay Latin.
    const result = measureFontPreferencesInContainer(document, container, {
      presets: { default: [undefined, persian] },
      normalizeForChromium128: false,
    })
    expect(typeof result.default).toBe('number')
    expect(FONT_PREFERENCE_PRESETS.default?.[1]).toBeUndefined()
    expect(FONT_PREFERENCES_DEFAULT_TEXT).toBe(latin)
  })
})

describe('getFontPreferences / registry', () => {
  it('rejects under Node (no silent empty record)', async () => {
    await expect(getFontPreferences({ cache: {} })).rejects.toBeInstanceOf(
      UnsupportedEnvironmentError,
    )
  })

  it('wires as source #4; Node load records error not fabricated widths', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[3]).toBe('fontPreferences')
    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isErrorComponent(result.components.fontPreferences)).toBe(true)
    if (isErrorComponent(result.components.fontPreferences)) {
      expect(result.components.fontPreferences.error).toBeInstanceOf(UnsupportedEnvironmentError)
    }
    expect(isValueComponent(result.components.domBlockers)).toBe(true)
  })

  it('hashes preference maps deterministically', () => {
    const value = {
      default: 100,
      apple: 100,
      serif: 110,
      sans: 105,
      mono: 120,
      min: 1,
      system: 100,
    }
    const a = hashComponents({ fontPreferences: { value, duration: 1 } })
    const b = hashComponents({ fontPreferences: { value, duration: 99 } })
    expect(a).toBe(b)
    expect(componentsToCanonicalString({ fontPreferences: { value, duration: 1 } })).toContain(
      'fontPreferences:',
    )
  })
})
