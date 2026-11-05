import {
  DOM_BLOCKER_MATCH_THRESHOLD,
  collectDomBlockers,
  componentsToCanonicalString,
  createBuiltinSources,
  getBlockedSelectors,
  getFilters,
  hashComponents,
  isDomBlockersApplicable,
  isValueComponent,
  load,
} from '@night-watch/browser-sdk'
import { parseSimpleCssSelector } from '@night-watch/core'
import { describe, expect, it, vi } from 'vitest'

/**
 * Document fixture for getBlockedSelectors.
 * createElement order matches implementation: root div, then (probe, holder) per selector.
 */
function createBlockedSelectorsDocument(blocked: ReadonlySet<string>, selectors: readonly string[]) {
  const bodyChildren: HTMLElement[] = []
  let createCount = 0
  const probeBySelector = new Map<string, HTMLElement>()

  const body = {
    appendChild(node: HTMLElement) {
      bodyChildren.push(node)
      return node
    },
  }

  const doc = {
    body,
    createElement(tag: string) {
      createCount += 1
      const attrs: Record<string, string> = {}
      const children: HTMLElement[] = []
      const el = {
        tagName: tag.toUpperCase(),
        style: {
          setProperty() {
            /* noop */
          },
        },
        setAttribute(name: string, value: string) {
          attrs[name] = value
        },
        getAttribute(name: string) {
          return attrs[name] ?? null
        },
        appendChild(child: HTMLElement) {
          children.push(child)
          return child
        },
        show() {
          /* dialog */
        },
        get offsetParent() {
          for (const [selector, probe] of probeBySelector) {
            if (probe === el) {
              return blocked.has(selector) ? null : (body as unknown as Element)
            }
          }
          return body as unknown as Element
        },
        parentNode: {
          removeChild(node: HTMLElement) {
            const idx = bodyChildren.indexOf(node)
            if (idx >= 0) {
              bodyChildren.splice(idx, 1)
            }
            return node
          },
        },
      } as unknown as HTMLElement

      // Index: 1=root; then pairs (probe at even createCount starting 2, holder at odd)
      if (createCount >= 2) {
        const pairIndex = createCount - 2
        if (pairIndex % 2 === 0) {
          const selector = selectors[pairIndex / 2]
          if (selector !== undefined) {
            probeBySelector.set(selector, el)
          }
        }
      }

      return el
    },
  } as unknown as Document

  return {
    document: doc,
    get attachedCount() {
      return bodyChildren.length
    },
  }
}

describe('getFilters dataset', () => {
  it('includes adBlockPersian and parses as single-element selectors', () => {
    const filters = getFilters()
    expect(filters.adBlockPersian?.length).toBe(5)
    expect(Object.keys(filters).length).toBeGreaterThan(30)

    for (const selectors of Object.values(filters)) {
      for (const selector of selectors) {
        expect(() => parseSimpleCssSelector(selector)).not.toThrow()
        // Avoid iframe *elements* / src loads (id names may still contain the substring).
        expect(selector.toLowerCase()).not.toMatch(/^iframe\b|\biframe[.#[:]/)
        expect(selector).not.toMatch(/\[src[=\]]/i)
      }
    }
  })

  it('does not perform network I/O when building filters', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      getFilters()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('getBlockedSelectors', () => {
  it('marks blocked probes, cleans up root, leaves others unblocked', async () => {
    const selectors = ['.blocked-a', '.ok-b', '.blocked-c'] as const
    const blocked = new Set(['.blocked-a', '.blocked-c'])
    const fixture = createBlockedSelectorsDocument(blocked, selectors)

    const map = await getBlockedSelectors(selectors, { document: fixture.document })
    expect(map['.blocked-a']).toBe(true)
    expect(map['.blocked-c']).toBe(true)
    expect(map['.ok-b']).toBeUndefined()
    expect(fixture.attachedCount).toBe(0)
  })
})

describe('threshold + collectDomBlockers', () => {
  it('requires strictly more than 60% blocked selectors', () => {
    expect(DOM_BLOCKER_MATCH_THRESHOLD).toBe(0.6)
    // 3/5 = 0.6 → not active; 4/5 = 0.8 → active
    expect(3 > 5 * DOM_BLOCKER_MATCH_THRESHOLD).toBe(false)
    expect(4 > 5 * DOM_BLOCKER_MATCH_THRESHOLD).toBe(true)
  })

  it('activates adBlockPersian when 4/5 selectors blocked; ignores minority false positives', async () => {
    const filters = getFilters()
    const persian = filters.adBlockPersian!
    const allSelectors = Object.values(filters).flat()

    const activeBlocked = new Set(persian.slice(0, 4))
    const activeFixture = createBlockedSelectorsDocument(activeBlocked, allSelectors)
    const activeMap = await getBlockedSelectors(allSelectors, { document: activeFixture.document })
    const active = Object.keys(filters)
      .filter((name) => {
        const sels = filters[name]!
        const count = sels.filter((s) => activeMap[s]).length
        return count > sels.length * DOM_BLOCKER_MATCH_THRESHOLD
      })
      .sort()
    expect(active).toEqual(['adBlockPersian'])

    const minority = new Set(persian.slice(0, 2))
    const minorityFixture = createBlockedSelectorsDocument(minority, allSelectors)
    const minorityMap = await getBlockedSelectors(allSelectors, {
      document: minorityFixture.document,
    })
    const minorityActive = Object.keys(filters).filter((name) => {
      const sels = filters[name]!
      const count = sels.filter((s) => minorityMap[s]).length
      return count > sels.length * DOM_BLOCKER_MATCH_THRESHOLD
    })
    expect(minorityActive).toEqual([])
  })

  it('is not applicable under Node; collect returns undefined', async () => {
    expect(isDomBlockersApplicable()).toBe(false)
    expect(await collectDomBlockers()).toBeUndefined()
    expect(await collectDomBlockers({ applicable: false })).toBeUndefined()
  })

  it('wires into builtin registry; Node load yields undefined value (not error)', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[2]).toBe('domBlockers')
    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.domBlockers)).toBe(true)
    if (isValueComponent(result.components.domBlockers)) {
      expect(result.components.domBlockers.value).toBeUndefined()
    }
    expect(componentsToCanonicalString({ domBlockers: result.components.domBlockers })).toBe(
      'domBlockers:undefined',
    )
    expect(hashComponents({ domBlockers: { value: ['adBlockPersian'], duration: 1 } })).toMatch(
      /^[0-9a-f]{32}$/,
    )
  })
})
