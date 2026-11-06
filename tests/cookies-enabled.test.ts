import {
  COOKIE_TEST_NAME,
  componentsToCanonicalString,
  createBuiltinSources,
  getCookiesEnabled,
  getCookiesEnabledValue,
  hashComponents,
  isValueComponent,
  load,
  probeCookiesEnabled,
  type DocumentWithCookie,
} from '@thenightwatch/browser-sdk'
import { describe, expect, it } from 'vitest'

function makeCookieJar(initial = ''): DocumentWithCookie & {
  writes: string[]
  jar: Map<string, string>
} {
  const jar = new Map<string, string>()
  if (initial) {
    for (const part of initial.split(';')) {
      const trimmed = part.trim()
      const eq = trimmed.indexOf('=')
      if (eq > 0) {
        jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
      }
    }
  }
  const writes: string[] = []
  const doc: DocumentWithCookie & { writes: string[]; jar: Map<string, string> } = {
    writes,
    jar,
    get cookie() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set cookie(value: string) {
      writes.push(value)
      const [pair] = value.split(';')
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const val = pair.slice(eq + 1)
      if (/expires=Thu, 01-Jan-1970/i.test(value)) {
        jar.delete(name)
      } else {
        jar.set(name, val)
      }
    },
  }
  return doc
}

describe('probeCookiesEnabled / getCookiesEnabledValue', () => {
  it('writes SameSite=Strict test cookie, detects it, then clears it', () => {
    const doc = makeCookieJar()
    expect(probeCookiesEnabled(doc)).toBe(true)
    expect(doc.writes[0]).toContain(`${COOKIE_TEST_NAME}=1`)
    expect(doc.writes[0]).toContain('SameSite=Strict')
    expect(doc.writes[1]).toMatch(/expires=Thu, 01-Jan-1970/i)
    expect(doc.jar.has(COOKIE_TEST_NAME)).toBe(false)
  })

  it('returns false when cookie write does not stick (blocked)', () => {
    const writes: string[] = []
    const doc: DocumentWithCookie = {
      get cookie() {
        return ''
      },
      set cookie(value: string) {
        writes.push(value)
        // Silently ignore writes (third-party / policy block simulation)
      },
    }
    expect(probeCookiesEnabled(doc)).toBe(false)
    expect(writes.length).toBeGreaterThanOrEqual(2) // set + clear attempted
  })

  it('SecurityError on cookie access → false; still attempts cleanup', () => {
    const writes: string[] = []
    const doc: DocumentWithCookie = {
      get cookie() {
        throw new Error('SecurityError')
      },
      set cookie(value: string) {
        writes.push(value)
        throw new Error('SecurityError')
      },
    }
    expect(probeCookiesEnabled(doc)).toBe(false)
    expect(writes.length).toBeGreaterThanOrEqual(1)
  })

  it('same-name existing cookietest still probes and clears the probe cookie', () => {
    const doc = makeCookieJar(`${COOKIE_TEST_NAME}=preexisting`)
    expect(probeCookiesEnabled(doc)).toBe(true)
    // Cleanup expires the probe name; preexisting value is overwritten then cleared.
    expect(doc.jar.has(COOKIE_TEST_NAME)).toBe(false)
  })

  it('cleanup runs even when read throws after a successful set', () => {
    let phase: 'init' | 'afterSet' | 'cleared' = 'init'
    const writes: string[] = []
    const doc: DocumentWithCookie = {
      get cookie() {
        if (phase === 'afterSet') {
          phase = 'cleared'
          throw new Error('read blocked')
        }
        return phase === 'init' ? '' : ''
      },
      set cookie(value: string) {
        writes.push(value)
        if (value.includes('expires=')) {
          phase = 'cleared'
        } else {
          phase = 'afterSet'
        }
      },
    }
    expect(probeCookiesEnabled(doc)).toBe(false)
    expect(writes.some((w) => /expires=/i.test(w))).toBe(true)
  })

  it('missing document / Node → false', () => {
    expect(probeCookiesEnabled(null)).toBe(false)
    expect(getCookiesEnabledValue({ document: null })).toBe(false)
    expect(getCookiesEnabledValue()).toBe(false)
  })

  it('does not consult navigator.cookieEnabled', () => {
    // Document blocks writes; a fake cookieEnabled=true must not flip the result.
    const doc: DocumentWithCookie = {
      get cookie() {
        return ''
      },
      set cookie(_value: string) {
        /* no-op */
      },
    }
    expect(getCookiesEnabledValue({ document: doc })).toBe(false)
  })
})

describe('builtin cookiesEnabled wiring', () => {
  it('wires cookiesEnabled as source #25; Node yields false', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[24]).toBe('cookiesEnabled')
    expect(sources.cookiesEnabled).toBe(getCookiesEnabled)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.cookiesEnabled)).toBe(true)
    if (isValueComponent(result.components.cookiesEnabled)) {
      expect(result.components.cookiesEnabled.value).toBe(false)
    }

    expect(
      componentsToCanonicalString({
        cookiesEnabled: { value: true, duration: 1 },
      }),
    ).toContain('cookiesEnabled:')
    expect(
      hashComponents({
        cookiesEnabled: { value: false, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
