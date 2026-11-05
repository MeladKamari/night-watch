/**
 * Thrown by builtin entropy sources that are registered but not yet implemented.
 * Collectors record this as `{ error, duration }` — never as a fabricated successful value.
 *
 * As of step 53, all 41 Default-profile sources are implemented; this class remains for
 * tests and any future registry stubs.
 */
export class SourceNotImplementedError extends Error {
  override readonly name = 'SourceNotImplementedError'
  readonly sourceName: string

  constructor(sourceName: string) {
    super(`Entropy source "${sourceName}" is not implemented yet`)
    this.sourceName = sourceName
  }
}
