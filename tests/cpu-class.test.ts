import {
  componentsToCanonicalString,
  createBuiltinSources,
  getCpuClass,
  getCpuClassValue,
  hashComponents,
  isErrorComponent,
  isValueComponent,
  load,
  readCpuClass,
} from '@thenightwatch/browser-sdk'
import { loadSource, type BuiltinSourceOptions, type Source } from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

describe('readCpuClass / getCpuClassValue', () => {
  it('returns legacy IE cpuClass when present (spoofed / injected)', () => {
    expect(readCpuClass({ cpuClass: 'x86' })).toBe('x86')
    expect(getCpuClassValue({ navigator: { cpuClass: 'x64' } })).toBe('x64')
  })

  it('returns undefined when absent (modern browsers / Node); never infers from UA', () => {
    expect(readCpuClass({})).toBeUndefined()
    expect(readCpuClass(null)).toBeUndefined()
    expect(getCpuClassValue({ navigator: null })).toBeUndefined()
    expect(getCpuClassValue()).toBeUndefined()
    // Must not invent from userAgent-like fields
    expect(
      readCpuClass({
        cpuClass: undefined,
      } as { cpuClass?: string; userAgent?: string }),
    ).toBeUndefined()
  })

  it('surfaces getter throws to loadSource error path', async () => {
    const hostile = {} as { cpuClass?: string }
    Object.defineProperty(hostile, 'cpuClass', {
      get() {
        throw new Error('cpuClass blocked')
      },
      configurable: true,
    })
    expect(() => getCpuClassValue({ navigator: hostile })).toThrow('cpuClass blocked')

    const source: Source<BuiltinSourceOptions, string | undefined> = () =>
      getCpuClassValue({ navigator: hostile })
    const component = await loadSource(source, { cache: {} })()
    expect(isErrorComponent(component)).toBe(true)
  })
})

describe('builtin cpuClass wiring', () => {
  it('wires cpuClass as source #19; Node yields undefined', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[18]).toBe('cpuClass')
    expect(sources.cpuClass).toBe(getCpuClass)

    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.cpuClass)).toBe(true)
    if (isValueComponent(result.components.cpuClass)) {
      expect(result.components.cpuClass.value).toBeUndefined()
    }

    expect(
      componentsToCanonicalString({
        cpuClass: { value: 'x86', duration: 1 },
      }),
    ).toContain('cpuClass:')
    expect(
      hashComponents({
        cpuClass: { value: undefined, duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
  })
})
