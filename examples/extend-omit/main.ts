/**
 * Compilable example: extend/omit helpers without registering applePay.
 */
import {
  extendComponents,
  hashComponents,
  withComponent,
  type UnknownComponents,
} from '@thenightwatch/browser-sdk'

export function demoCustomHash(base: UnknownComponents): string {
  const tagged = withComponent(base, 'appBuild', {
    value: 'docs-example',
    duration: 0,
  })
  const merged = extendComponents(tagged, {
    experiment: { value: 1, duration: 0 },
  })
  return hashComponents(merged)
}

/** @throws if caller tries to register the excluded payment key via helpers that enforce it */
export function assertNoApplePayKey(components: UnknownComponents): void {
  if (Object.prototype.hasOwnProperty.call(components, 'applePay')) {
    throw new Error('applePay must not appear in hashed components for default-profile')
  }
}
