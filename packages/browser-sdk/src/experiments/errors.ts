export class ExperimentConsentError extends Error {
  override readonly name = 'ExperimentConsentError'
  readonly status: string

  constructor(status: string, message?: string) {
    super(message ?? `Entropy experiment consent is ${status}`)
    this.status = status
  }
}
