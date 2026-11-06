import {
  ALGORITHM_SCHEMA,
  APPLE_PAY_EXCLUDED,
  ENABLED_SOURCE_COUNT,
  ENABLED_SOURCES,
  EXCLUDED_UPSTREAM_SOURCE,
  SOURCE_MANIFEST_REVISION,
  isErrorComponent,
  isValueComponent,
  type BuiltinComponents,
  type Component,
  type EnabledSourceName,
  type Source,
  type SourceValue,
  type SourcesToComponents,
} from '@thenightwatch/core'
import type {
  Agent,
  GetResult,
  LoadOptions,
} from '@thenightwatch/browser-sdk'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  runtimeGuards,
  sampleErrorComponent,
  sampleSuccessComponent,
  type PublicCoreTypes,
  type PublicSdkTypes,
} from './fixtures/public-api-types.js'

describe('public API type contracts', () => {
  it('exposes algorithm schema tied to default-v1', () => {
    expect(ALGORITHM_SCHEMA.sourceManifestRevision).toBe('default-v1')
    expect(ALGORITHM_SCHEMA.sourceManifestRevision).toBe(SOURCE_MANIFEST_REVISION)
    expect(ALGORITHM_SCHEMA.enabledSourceCount).toBe(41)
    expect(ALGORITHM_SCHEMA.enabledSourceCount).toBe(ENABLED_SOURCE_COUNT)
    expect(ALGORITHM_SCHEMA.enabledSources).toEqual([...ENABLED_SOURCES])
    expect(ALGORITHM_SCHEMA.hashingRevision).toBe('murmur3-x64-128-canonical-v1')
    expect(ALGORITHM_SCHEMA.confidenceRevision).toBe('heuristic-platform-v1')
    expect(APPLE_PAY_EXCLUDED).toBe(true)
    expect(EXCLUDED_UPSTREAM_SOURCE).toBe('applePay')
  })

  it('discriminates success and error components at runtime', () => {
    const ok = sampleSuccessComponent()
    const bad = sampleErrorComponent()
    expect(isValueComponent(ok)).toBe(true)
    expect(isErrorComponent(ok)).toBe(false)
    expect(isErrorComponent(bad)).toBe(true)
    expect(isValueComponent(bad)).toBe(false)
    if (isValueComponent(ok)) {
      expect(ok.value).toBe('ok')
      expect(ok.duration).toBe(1)
    }
    if (isErrorComponent(bad)) {
      expect(bad.error).toBeInstanceOf(Error)
      expect(bad.duration).toBe(2)
    }
  })

  it('keeps fixture runtime guards importable under Node', () => {
    expect(runtimeGuards.APPLE_PAY_EXCLUDED).toBe(true)
    expect(runtimeGuards.ENABLED_SOURCES).toHaveLength(41)
  })

  it('types Component success and error arms', () => {
    expectTypeOf<Component<string>>().toMatchTypeOf<
      { value: string; duration: number } | { error: unknown; duration: number }
    >()

    const success: Component<number> = { value: 42, duration: 3 }
    const failure: Component<number> = { error: 'x', duration: 4 }
    expectTypeOf(success).toMatchTypeOf<Component<number>>()
    expectTypeOf(failure).toMatchTypeOf<Component<number>>()
  })

  it('types BuiltinComponents as exactly the 41 enabled keys', () => {
    expectTypeOf<keyof BuiltinComponents>().toEqualTypeOf<EnabledSourceName>()
    expectTypeOf<BuiltinComponents>().not.toHaveProperty('applePay')
    expectTypeOf<PublicCoreTypes['AssertApplePayExcluded']>().toEqualTypeOf<true>()

    type HasApplePay = 'applePay' extends keyof BuiltinComponents ? true : false
    expectTypeOf<HasApplePay>().toEqualTypeOf<false>()
  })

  it('infers SourcesToComponents from Source maps', () => {
    type SampleSources = {
      alpha: Source<{ cache: Record<string, unknown> }, string>
      beta: Source<{ cache: Record<string, unknown> }, number>
    }
    type SampleComponents = SourcesToComponents<SampleSources>
    expectTypeOf<SampleComponents['alpha']>().toEqualTypeOf<Component<string>>()
    expectTypeOf<SampleComponents['beta']>().toEqualTypeOf<Component<number>>()
    expectTypeOf<SourceValue<SampleSources['alpha']>>().toEqualTypeOf<string>()
  })

  it('types LoadOptions monitoring as optional boolean (default false by policy)', () => {
    expectTypeOf<LoadOptions>().toMatchTypeOf<{
      delayFallback?: number
      debug?: boolean
      monitoring?: boolean
      excludeSources?: readonly string[]
      customSources?: unknown
      overwriteBuiltins?: boolean
    }>()
    const opts: LoadOptions = { monitoring: false }
    expect(opts.monitoring).toBe(false)
  })

  it('types GetResult and Agent surfaces', () => {
    expectTypeOf<GetResult>().toMatchTypeOf<{
      visitorId: string
      confidence: { score: number; comment?: string }
      components: BuiltinComponents
      version: string
    }>()
    expectTypeOf<Agent['get']>().returns.toEqualTypeOf<Promise<GetResult>>()
    expectTypeOf<PublicSdkTypes['Load']>().toBeFunction()
    expectTypeOf<PublicSdkTypes['HashComponents']>().toBeFunction()
    expectTypeOf<PublicSdkTypes['ComponentsToDebugString']>().toBeFunction()
  })
})
