/** Raised when an offscreen iframe helper exceeds its timeout. */
export class DomOperationTimeoutError extends Error {
  override readonly name = 'DomOperationTimeoutError'

  constructor(message = 'DOM iframe operation timed out') {
    super(message)
  }
}
