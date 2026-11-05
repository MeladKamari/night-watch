export class PluginRegistrationError extends Error {
  override readonly name = 'PluginRegistrationError'
}

export class PluginDependencyError extends Error {
  override readonly name = 'PluginDependencyError'
}

export class PluginTimeoutError extends Error {
  override readonly name = 'PluginTimeoutError'
  readonly timeoutMs: number
  readonly pluginKey: string

  constructor(pluginKey: string, timeoutMs: number) {
    super(`Plugin "${pluginKey}" exceeded timeout budget of ${timeoutMs}ms`)
    this.pluginKey = pluginKey
    this.timeoutMs = timeoutMs
  }
}

export class PluginJsonSafetyError extends Error {
  override readonly name = 'PluginJsonSafetyError'
}

export class PluginAbortError extends Error {
  override readonly name = 'PluginAbortError'
}
