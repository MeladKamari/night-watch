import type { Component } from '../types.js'

/**
 * Literal token substituted for any component `error` during canonical hashing.
 * Matches FingerprintJS OSS v5.3.0 `componentsToCanonicalString` behavior.
 * The exception object itself is never hashed; `duration` is never hashed.
 */
export const COMPONENT_ERROR_HASH_SENTINEL = 'error' as const

/** True when the component carries an error arm (hash path uses the sentinel). */
export function componentHasError<T>(component: Component<T>): component is {
  error: unknown
  duration: number
} {
  return 'error' in component
}

/**
 * Value contribution for hashing: sentinel `'error'` or the successful `value`.
 * Does not serialize; canonicalization happens in the hashing step.
 */
export function componentValueForHash<T>(component: Component<T>): T | typeof COMPONENT_ERROR_HASH_SENTINEL {
  return componentHasError(component) ? COMPONENT_ERROR_HASH_SENTINEL : component.value
}
