import {
  hashComponents,
  isErrorComponent,
  isValueComponent,
  type Component,
  type UnknownComponents,
} from '@night-watch/core'
import type { GetResult } from '../types.js'
import { expectedInstabilityFor, hintForChange } from './hints.js'
import { armOf, previewComponent, stableStringify } from './preview.js'
import { redactDeep, redactErrorForDiagnostics } from '../diagnostics/redact.js'
import {
  CHANGE_INSPECTOR_DISCLAIMER,
  CHANGE_INSPECTOR_REVISION,
  type FingerprintChangeReport,
  type InspectFingerprintChangeOptions,
  type SourceChangeKind,
  type SourceChangeRow,
} from './types.js'

export type FingerprintCollectionInput = {
  readonly visitorId?: string
  readonly components: UnknownComponents
}

const DEFAULT_DURATION_THRESHOLD_MS = 5
const DEFAULT_PREVIEW_MAX = 120

/**
 * Accepts a {@link GetResult} or a bare `{ components, visitorId? }` pair.
 */
export function toCollectionInput(
  input: GetResult | FingerprintCollectionInput,
): FingerprintCollectionInput {
  if (input == null || typeof input !== 'object' || !('components' in input)) {
    throw new TypeError('Fingerprint collection input must include components')
  }
  const components = input.components as UnknownComponents
  if (components == null || typeof components !== 'object') {
    throw new TypeError('components must be an object')
  }
  const visitorId =
    'visitorId' in input && typeof input.visitorId === 'string'
      ? input.visitorId
      : undefined
  return visitorId === undefined ? { components } : { components, visitorId }
}

function canonicalPayload(component: Component<unknown> | undefined): string {
  if (component === undefined) return '∅'
  if (isErrorComponent(component)) {
    return `error:${stableStringify(redactErrorForDiagnostics(component.error))}`
  }
  if (isValueComponent(component)) {
    return `value:${stableStringify(redactDeep(component.value))}`
  }
  return 'unrecognized'
}

function classifyKind(
  before: Component<unknown> | undefined,
  after: Component<unknown> | undefined,
  durationThresholdMs: number,
): SourceChangeKind {
  if (before === undefined && after === undefined) return 'unchanged'
  if (before === undefined) return 'added'
  if (after === undefined) return 'removed'

  const beforeArm = armOf(before)
  const afterArm = armOf(after)
  const samePayload = canonicalPayload(before) === canonicalPayload(after)

  if (beforeArm === 'value' && afterArm === 'error') return 'value_to_error'
  if (beforeArm === 'error' && afterArm === 'value') return 'error_to_value'
  if (beforeArm === 'error' && afterArm === 'error' && !samePayload) {
    return 'error_changed'
  }
  if (beforeArm === 'value' && afterArm === 'value' && !samePayload) {
    return 'value_changed'
  }

  const beforeDur = before.duration
  const afterDur = after.duration
  if (
    samePayload &&
    Math.abs(afterDur - beforeDur) >= durationThresholdMs
  ) {
    return 'duration_only'
  }

  return 'unchanged'
}

function buildRow(
  source: string,
  before: Component<unknown> | undefined,
  after: Component<unknown> | undefined,
  kind: SourceChangeKind,
  previewMaxLength: number,
): SourceChangeRow {
  const beforeDurationMs = before === undefined ? null : before.duration
  const afterDurationMs = after === undefined ? null : after.duration
  const durationDeltaMs =
    beforeDurationMs === null || afterDurationMs === null
      ? null
      : afterDurationMs - beforeDurationMs
  const expectedInstability = expectedInstabilityFor(source)

  return {
    source,
    kind,
    beforeArm: armOf(before),
    afterArm: armOf(after),
    beforePreview: previewComponent(before, previewMaxLength),
    afterPreview: previewComponent(after, previewMaxLength),
    beforeDurationMs,
    afterDurationMs,
    durationDeltaMs,
    expectedInstability,
    hint: hintForChange(source, kind, expectedInstability),
  }
}

/**
 * Diff two local fingerprint collections.
 * Pure / SSR-safe — no network, no storage writes.
 * Results are probabilistic hints, not identity guarantees.
 */
export function inspectFingerprintChange(
  beforeInput: GetResult | FingerprintCollectionInput,
  afterInput: GetResult | FingerprintCollectionInput,
  options: InspectFingerprintChangeOptions = {},
): FingerprintChangeReport {
  const before = toCollectionInput(beforeInput)
  const after = toCollectionInput(afterInput)

  const includeUnchangedInRows = options.includeUnchangedInRows !== false
  const durationThresholdMs =
    options.durationDeltaThresholdMs === undefined
      ? DEFAULT_DURATION_THRESHOLD_MS
      : options.durationDeltaThresholdMs
  const previewMaxLength =
    options.previewMaxLength === undefined ? DEFAULT_PREVIEW_MAX : options.previewMaxLength

  if (!Number.isFinite(durationThresholdMs) || durationThresholdMs < 0) {
    throw new TypeError('durationDeltaThresholdMs must be a non-negative finite number')
  }
  if (!Number.isFinite(previewMaxLength) || previewMaxLength < 16) {
    throw new TypeError('previewMaxLength must be a finite number ≥ 16')
  }

  const keys = new Set([
    ...Object.keys(before.components),
    ...Object.keys(after.components),
  ])
  // Stable lexicographic sort (locale-independent via default UTF-16 code unit order).
  const sortedKeys = [...keys].sort()

  const rows: SourceChangeRow[] = []
  for (const source of sortedKeys) {
    if (source === 'applePay') {
      // Never surface the excluded payment source in inspector output.
      continue
    }
    const beforeComponent = before.components[source]
    const afterComponent = after.components[source]
    const kind = classifyKind(beforeComponent, afterComponent, durationThresholdMs)
    if (!includeUnchangedInRows && kind === 'unchanged') {
      continue
    }
    rows.push(buildRow(source, beforeComponent, afterComponent, kind, previewMaxLength))
  }

  const changes = rows.filter((row) => row.kind !== 'unchanged')
  const beforeVisitorId =
    before.visitorId ??
    (Object.keys(before.components).length > 0 ? hashComponents(before.components) : null)
  const afterVisitorId =
    after.visitorId ??
    (Object.keys(after.components).length > 0 ? hashComponents(after.components) : null)

  const notes: string[] = [
    `Change inspector ${CHANGE_INSPECTOR_REVISION}; default load()/hashComponents unchanged.`,
    'Local comparison only — SDK performs no network upload.',
    'Previews are redacted; volatile tiers are operational heuristics.',
  ]
  if (beforeVisitorId !== null && afterVisitorId !== null && beforeVisitorId !== afterVisitorId) {
    notes.push('visitorId differs between collections (expected when any hashed component changes).')
  }
  if (changes.some((row) => row.expectedInstability === 'volatile')) {
    notes.push('At least one volatile-tier source changed — often environmental, not identity.')
  }

  return {
    revision: CHANGE_INSPECTOR_REVISION,
    beforeVisitorId,
    afterVisitorId,
    visitorIdChanged:
      beforeVisitorId !== null &&
      afterVisitorId !== null &&
      beforeVisitorId !== afterVisitorId,
    comparedSourceCount: sortedKeys.filter((k) => k !== 'applePay').length,
    changedSourceCount: changes.length,
    rows,
    changes,
    notes,
    disclaimer: CHANGE_INSPECTOR_DISCLAIMER,
  }
}
