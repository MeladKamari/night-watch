import {
  COMPONENT_ERROR_HASH_SENTINEL,
  componentValueForHash,
  componentsToDebugString,
  errorToObject,
  isErrorComponent,
  isValueComponent,
  loadSources,
  toError,
  type Source,
  type UnknownComponents,
} from '@thenightwatch/core'
import { describe, expect, it } from 'vitest'

type Opts = { cache: Record<string, unknown> }

describe('errorToObject / componentsToDebugString', () => {
  it('serializes Error fields that JSON.stringify would omit', () => {
    const error = new Error('boom')
    const plain = errorToObject(error)
    expect(plain.name).toBe('Error')
    expect(plain.message).toBe('boom')
    expect(Array.isArray(plain.stack)).toBe(true)
    // Native Error message/stack are non-enumerable — raw stringify omits them.
    expect(JSON.stringify(error)).not.toContain('boom')
    expect(JSON.stringify(plain)).toContain('boom')
  })

  it('serializes DOMException-like errors for debug', () => {
    const DomExceptionCtor = globalThis.DOMException
    expect(DomExceptionCtor).toBeTypeOf('function')
    const error = new DomExceptionCtor('The operation is insecure.', 'SecurityError')
    const plain = errorToObject(error)
    expect(plain.name).toBe('SecurityError')
    expect(plain.message).toContain('insecure')
  })

  it('redacts sensitive own properties on errors', () => {
    const error = new Error('auth failed') as Error & { token: string; password: string }
    error.token = 'super-secret-token'
    error.password = 'hunter2'
    const plain = errorToObject(error)
    expect(plain.token).toBe('[redacted]')
    expect(plain.password).toBe('[redacted]')
    expect(JSON.stringify(plain)).not.toContain('super-secret-token')
    expect(JSON.stringify(plain)).not.toContain('hunter2')
  })

  it('pretty-prints components with nested Error values', () => {
    const components: UnknownComponents = {
      ok: { value: 'x', duration: 1 },
      bad: { error: new Error('nope'), duration: 2 },
    }
    const debug = componentsToDebugString(components)
    const parsed = JSON.parse(debug) as UnknownComponents
    expect(parsed.ok).toEqual({ value: 'x', duration: 1 })
    expect(parsed.bad && 'error' in parsed.bad).toBe(true)
    const badError = (parsed.bad as { error: { name: string; message: string } }).error
    expect(badError.name).toBe('Error')
    expect(badError.message).toBe('nope')
    expect(debug).not.toMatch(/https?:\/\//)
  })

  it('keeps hash sentinel independent of exception object contents', () => {
    const withError = { error: new Error('anything'), duration: 3 }
    const withValue = { value: { deep: true }, duration: 4 }
    expect(componentValueForHash(withError)).toBe(COMPONENT_ERROR_HASH_SENTINEL)
    expect(componentValueForHash(withValue)).toEqual({ deep: true })
    expect(COMPONENT_ERROR_HASH_SENTINEL).toBe('error')
  })

  it('toError normalizes arbitrary thrown values', () => {
    expect(toError(new Error('e')).message).toBe('e')
    expect(toError('string-throw').message).toBe('string-throw')
    expect(toError({ a: 1 }).message).toContain('a')
  })
})

describe('collector error isolation (get does not reject wholesale)', () => {
  it('resolves all components when sources throw Error, DOMException, and plain objects', async () => {
    const DomExceptionCtor = globalThis.DOMException
    const sources = {
      fine: (() => 'ok') as Source<Opts, string>,
      throwsError: (() => {
        throw new Error('classic')
      }) as Source<Opts, string>,
      throwsDom: (() => {
        throw new DomExceptionCtor('denied', 'SecurityError')
      }) as Source<Opts, string>,
      throwsObject: (() => {
        throw { weird: true, token: 'should-stay-in-component-not-debug-yet' }
      }) as Source<Opts, unknown>,
    }

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)

    const components = await loadSources(sources, { cache: {} }, [])()

    process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toHaveLength(0)

    expect(isValueComponent(components.fine!)).toBe(true)
    expect(isErrorComponent(components.throwsError!)).toBe(true)
    expect(isErrorComponent(components.throwsDom!)).toBe(true)
    expect(isErrorComponent(components.throwsObject!)).toBe(true)

    const debug = componentsToDebugString(components)
    expect(debug).toContain('classic')
    expect(debug).toContain('SecurityError')
    // Plain object errors are not Error instances — JSON.stringify keeps them as objects.
    expect(debug).toContain('weird')
    expect(debug).not.toContain('should-stay-in-component-not-debug-yet')
    expect(debug).toContain('[redacted]')
  })
})
