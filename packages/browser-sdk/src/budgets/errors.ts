export class CollectionBudgetError extends Error {
  override readonly name: string = 'CollectionBudgetError'
}

export class CollectionAbortError extends CollectionBudgetError {
  override readonly name = 'CollectionAbortError'

  constructor(message = 'Fingerprint collection was aborted') {
    super(message)
  }
}

export class CollectionTimeoutError extends CollectionBudgetError {
  override readonly name = 'CollectionTimeoutError'
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Fingerprint collection exceeded total budget of ${timeoutMs}ms`)
    this.timeoutMs = timeoutMs
  }
}

export class SourceTimeoutError extends CollectionBudgetError {
  override readonly name = 'SourceTimeoutError'
  readonly sourceKey: string
  readonly timeoutMs: number
  readonly stage: 'load' | 'get'

  constructor(sourceKey: string, timeoutMs: number, stage: 'load' | 'get') {
    super(`Source "${sourceKey}" exceeded ${stage}-stage budget of ${timeoutMs}ms`)
    this.sourceKey = sourceKey
    this.timeoutMs = timeoutMs
    this.stage = stage
  }
}
