/**
 * Compile-only fixture: importing/using every public contract type must typecheck.
 * Consumed by `tests/public-contracts.test.ts`.
 */
import type {
  AlgorithmSchema,
  AssertApplePayExcluded,
  BuiltinComponents,
  BuiltinSourceOptions,
  BuiltinSources,
  Component,
  ComponentOutcomeKind,
  Confidence,
  EnabledSourceName,
  MaybePromise,
  Source,
  SourceValue,
  SourcesToComponents,
  UnknownComponents,
  UnknownSources,
} from '@night-watch/core'
import {
  ALGORITHM_SCHEMA,
  APPLE_PAY_EXCLUDED,
  ENABLED_SOURCES,
  isErrorComponent,
  isValueComponent,
} from '@night-watch/core'
import type {
  Agent,
  BrowserSdkDefaultExport,
  ComponentsToDebugString,
  GetOptions,
  GetResult,
  HashComponents,
  Load,
  LoadOptions,
} from '@night-watch/browser-sdk'

export type PublicCoreTypes = {
  MaybePromise: MaybePromise<string>
  Source: Source<BuiltinSourceOptions, number>
  SourceValue: SourceValue<Source<BuiltinSourceOptions, number>>
  ComponentSuccess: Component<string>
  ComponentError: Component<never>
  UnknownComponents: UnknownComponents
  UnknownSources: UnknownSources<BuiltinSourceOptions>
  SourcesToComponents: SourcesToComponents<BuiltinSources>
  Confidence: Confidence
  ComponentOutcomeKind: ComponentOutcomeKind
  BuiltinComponents: BuiltinComponents
  BuiltinSources: BuiltinSources
  BuiltinSourceOptions: BuiltinSourceOptions
  AlgorithmSchema: AlgorithmSchema
  AssertApplePayExcluded: AssertApplePayExcluded
  EnabledSourceName: EnabledSourceName
}

export type PublicSdkTypes = {
  LoadOptions: LoadOptions
  GetOptions: GetOptions
  GetResult: GetResult
  Agent: Agent
  Load: Load
  HashComponents: HashComponents
  ComponentsToDebugString: ComponentsToDebugString
  BrowserSdkDefaultExport: BrowserSdkDefaultExport
}

export const runtimeGuards = {
  ALGORITHM_SCHEMA,
  APPLE_PAY_EXCLUDED,
  ENABLED_SOURCES,
  isValueComponent,
  isErrorComponent,
}

export function sampleSuccessComponent(): Component<string> {
  return { value: 'ok', duration: 1 }
}

export function sampleErrorComponent(): Component<string> {
  return { error: new Error('boom'), duration: 2 }
}
