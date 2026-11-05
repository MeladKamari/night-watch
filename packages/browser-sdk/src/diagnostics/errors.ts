export class DiagnosticsError extends Error {
  override readonly name: string = 'DiagnosticsError'
}

export class DiagnosticsValidationError extends DiagnosticsError {
  override readonly name = 'DiagnosticsValidationError'
  readonly details: readonly string[]

  constructor(details: readonly string[]) {
    super(`Diagnostic snapshot validation failed: ${details.join('; ')}`)
    this.details = details
  }
}
