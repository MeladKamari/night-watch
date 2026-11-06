import {
  componentsToCanonicalString,
  createBuiltinSources,
  getPrivateClickMeasurement,
  getPrivateClickMeasurementValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  probePrivateClickMeasurement,
  readPrivateClickMeasurement,
  type AnchorWithAttribution,
  type DocumentWithCreateAnchor,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readPrivateClickMeasurement / getPrivateClickMeasurementValue', () => {
  it('property absent → undefined (Chromium / mobile Safari semantics)', () => {
    expect(readPrivateClickMeasurement({})).toBeUndefined()
    expect(readPrivateClickMeasurement(null)).toBeUndefined()
    expect(getPrivateClickMeasurementValue({ link: {} })).toBeUndefined()
    expect(getPrivateClickMeasurementValue({ link: null })).toBeUndefined()
    expect(getPrivateClickMeasurementValue({ document: null })).toBeUndefined()
    // Node / no document
    expect(getPrivateClickMeasurementValue()).toBeUndefined()
  })

  it('desktop Safari-like: camelCase / lowercase → stringified id', () => {
    // Safari ≥15 desktop often exposes "0"
    expect(readPrivateClickMeasurement({ attributionSourceId: 0 })).toBe('0')
    expect(readPrivateClickMeasurement({ attributionsourceid: 0 })).toBe('0')
    // Safari 14.x desktop often exposes empty string
    expect(readPrivateClickMeasurement({ attributionSourceId: '' })).toBe('')
    expect(getPrivateClickMeasurementValue({ link: { attributionSourceId: '0' } })).toBe('0')
  })

  it('null falls through ?? like upstream; both-null stringifies to "null"', () => {
    // `null ?? undefined` → undefined (unsupported), matching `??` semantics
    expect(readPrivateClickMeasurement({ attributionSourceId: null })).toBeUndefined()
    // Final resolved value null → String(null)
    expect(
      readPrivateClickMeasurement({
        attributionSourceId: null,
        attributionsourceid: null,
      }),
    ).toBe('null')
  })

  it('camelCase takes precedence over lowercase via ??', () => {
    expect(
      readPrivateClickMeasurement({
        attributionSourceId: '0',
        attributionsourceid: '9',
      }),
    ).toBe('0')
    expect(
      readPrivateClickMeasurement({
        attributionSourceId: undefined,
        attributionsourceid: '9',
      }),
    ).toBe('9')
    // null on camelCase falls through to lowercase
    expect(
      readPrivateClickMeasurement({
        attributionSourceId: null,
        attributionsourceid: '9',
      }),
    ).toBe('9')
  })

  it('probe creates unattached anchor via document.createElement', () => {
    let createdTag: string | undefined
    const doc: DocumentWithCreateAnchor = {
      createElement(tagName: 'a') {
        createdTag = tagName
        return { attributionSourceId: 0 } as AnchorWithAttribution
      },
    }
    expect(probePrivateClickMeasurement(doc)).toBe('0')
    expect(createdTag).toBe('a')
    expect(getPrivateClickMeasurementValue({ document: doc })).toBe('0')
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as AnchorWithAttribution
    Object.defineProperty(hostile, 'attributionSourceId', {
      get() {
        throw new Error('pcm blocked')
      },
      configurable: true,
    })
    expect(() => readPrivateClickMeasurement(hostile)).toThrow('pcm blocked')

    const source: Source<BuiltinSourceOptions, string | undefined> = () =>
      getPrivateClickMeasurementValue({ link: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin privateClickMeasurement wiring', () => {
  it('wires privateClickMeasurement as source #37; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[36]).toBe('privateClickMeasurement')
    expect(sources.privateClickMeasurement).toBe(getPrivateClickMeasurement)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.privateClickMeasurement)).toBe(true)
    if (isValueComponent(result.components.privateClickMeasurement)) {
      expect(result.components.privateClickMeasurement.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        privateClickMeasurement: { value: '0', duration: 1 },
      }),
    ).toContain('privateClickMeasurement:')
    expect(
      hashComponents({
        privateClickMeasurement: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
    expect(
      hashComponents({ privateClickMeasurement: { value: '0', duration: 1 } }),
    ).not.toBe(
      hashComponents({ privateClickMeasurement: { value: '', duration: 1 } }),
    )
  })
})
