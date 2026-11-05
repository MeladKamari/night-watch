import {
  DomOperationTimeoutError,
  UnsupportedEnvironmentError,
  addStyleString,
  getFrameElement,
  isAnyParentCrossOrigin,
  isCurrentFrameSandboxed,
  isFullscreenActive,
  isInIframe,
  parseSimpleCssSelector,
  withIframe,
} from '@night-watch/core'
import { describe, expect, it } from 'vitest'

describe('parseSimpleCssSelector', () => {
  it('parses tag, id, class and attribute parts', () => {
    expect(parseSimpleCssSelector('div#main.foo.bar[data-x="1"]')).toEqual([
      'div',
      {
        id: ['main'],
        class: ['foo', 'bar'],
        'data-x': ['1'],
      },
    ])
  })

  it('allows empty tag (defaults later to div)', () => {
    expect(parseSimpleCssSelector('.only-class')).toEqual([
      undefined,
      { class: ['only-class'] },
    ])
  })

  it('rejects unexpected attribute syntax', () => {
    expect(() => parseSimpleCssSelector('div[===]')).toThrow(/Unexpected syntax/)
  })
})

describe('addStyleString (CSP-safe)', () => {
  it('applies declarations via setProperty, not cssText assignment', () => {
    const calls: Array<{ name: string; value: string; priority: string }> = []
    const style = {
      setProperty(name: string, value: string, priority = '') {
        calls.push({ name, value, priority })
      },
    } as unknown as CSSStyleDeclaration

    addStyleString(style, 'color: red; font-size: 12px !important;')
    expect(calls).toEqual([
      { name: 'color', value: 'red', priority: '' },
      { name: 'font-size', value: '12px', priority: 'important' },
    ])
  })

  it('ignores empty / malformed fragments', () => {
    const calls: string[] = []
    const style = {
      setProperty(name: string) {
        calls.push(name)
      },
    } as unknown as CSSStyleDeclaration
    addStyleString(style, ';; ; not-a-decl ; width: 1px')
    expect(calls).toEqual(['width'])
  })
})

describe('DOM iframe helpers under Node', () => {
  it('withIframe rejects with UnsupportedEnvironmentError', async () => {
    await expect(withIframe(async () => 1)).rejects.toBeInstanceOf(UnsupportedEnvironmentError)
  })

  it('frame/fullscreen detectors stay inert (no throw, no true positives)', () => {
    expect(isInIframe()).toBe(false)
    expect(isAnyParentCrossOrigin()).toBe(false)
    expect(getFrameElement()).toBeNull()
    expect(isCurrentFrameSandboxed()).toBeNull()
    expect(isFullscreenActive()).toBe(false)
  })

  it('exposes DomOperationTimeoutError name for collectors', () => {
    const error = new DomOperationTimeoutError()
    expect(error.name).toBe('DomOperationTimeoutError')
    expect(error).toBeInstanceOf(Error)
  })
})
