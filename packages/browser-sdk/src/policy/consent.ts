import type { ConsentSignal, ConsentStatus } from './types.js'

export class CollectionConsentError extends Error {
  override readonly name = 'CollectionConsentError'
  readonly status: ConsentStatus

  constructor(status: ConsentStatus, message?: string) {
    super(
      message ??
        `Collection refused: consent status is "${status}". Collectors were not started.`,
    )
    this.status = status
  }
}

/** Statuses that allow collectors to start under an explicit policy. */
export function isConsentAllowingCollection(status: ConsentStatus): boolean {
  return status === 'granted' || status === 'not_required'
}

/**
 * Throws {@link CollectionConsentError} when consent is denied or withdrawn.
 * Does not inspect region, locale, or IP.
 */
export function assertConsentAllowsCollection(consent: ConsentSignal): void {
  if (!isConsentAllowingCollection(consent.status)) {
    throw new CollectionConsentError(consent.status)
  }
}
