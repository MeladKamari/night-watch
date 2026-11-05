import { findForbiddenPageContextKeys } from './redact.js'
import {
  DIAGNOSTICS_REVISION,
  DIAGNOSTICS_SNAPSHOT_SCHEMA,
  type DiagnosticSnapshot,
  type DiagnosticValidationResult,
} from './types.js'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Schema-validates a diagnostic snapshot (structural + forbidden page-context keys).
 */
export function validateDiagnosticSnapshot(input: unknown): DiagnosticValidationResult {
  const errors: string[] = []

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['snapshot must be a plain object'] }
  }

  if (input.schema !== DIAGNOSTICS_SNAPSHOT_SCHEMA) {
    errors.push(`schema must be "${DIAGNOSTICS_SNAPSHOT_SCHEMA}"`)
  }
  if (input.revision !== DIAGNOSTICS_REVISION) {
    errors.push(`revision must be "${DIAGNOSTICS_REVISION}"`)
  }
  if (typeof input.exportedAt !== 'string' || !input.exportedAt) {
    errors.push('exportedAt must be a non-empty string')
  }
  if (typeof input.packageVersion !== 'string' || !input.packageVersion) {
    errors.push('packageVersion must be a non-empty string')
  }
  if (typeof input.visitorId !== 'string' || !/^[0-9a-f]{32}$/i.test(input.visitorId)) {
    errors.push('visitorId must be a 32-char hex string')
  }
  if (!isPlainObject(input.confidence)) {
    errors.push('confidence must be an object')
  }
  if (!Array.isArray(input.componentKeys)) {
    errors.push('componentKeys must be an array')
  }
  if (!isPlainObject(input.components)) {
    errors.push('components must be an object')
  }
  if (!Array.isArray(input.notes)) {
    errors.push('notes must be an array')
  }
  if (typeof input.sourceManifestRevision !== 'string' || !input.sourceManifestRevision) {
    errors.push('sourceManifestRevision must be a non-empty string')
  }
  if (typeof input.hashingRevision !== 'string' || !input.hashingRevision) {
    errors.push('hashingRevision must be a non-empty string')
  }
  if (typeof input.confidenceRevision !== 'string' || !input.confidenceRevision) {
    errors.push('confidenceRevision must be a non-empty string')
  }

  if (isPlainObject(input.components)) {
    for (const [key, component] of Object.entries(input.components)) {
      if (!isPlainObject(component)) {
        errors.push(`components.${key} must be an object`)
        continue
      }
      if (typeof component.duration !== 'number') {
        errors.push(`components.${key}.duration must be a number`)
      }
      const hasValue = Object.prototype.hasOwnProperty.call(component, 'value')
      const hasError = Object.prototype.hasOwnProperty.call(component, 'error')
      if (hasValue === hasError) {
        errors.push(`components.${key} must have exactly one of value|error`)
      }
    }
  }

  if (input.componentKeys && Array.isArray(input.componentKeys) && input.componentKeys.includes('applePay')) {
    errors.push('applePay must not appear in diagnostic snapshots')
  }

  // Component key names may legitimately match storage APIs; scan values + environment only.
  const scanTargets: unknown[] = [input.environment, input.notes]
  if (isPlainObject(input.components)) {
    for (const component of Object.values(input.components)) {
      if (isPlainObject(component)) {
        if (Object.prototype.hasOwnProperty.call(component, 'value')) {
          scanTargets.push(component.value)
        }
        if (Object.prototype.hasOwnProperty.call(component, 'error')) {
          scanTargets.push(component.error)
        }
      }
    }
  }
  for (const target of scanTargets) {
    for (const path of findForbiddenPageContextKeys(target)) {
      errors.push(`forbidden page-context key present: ${path}`)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, snapshot: input as unknown as DiagnosticSnapshot }
}
