type MessageChannelCtor = {
  new (): {
    port1: { onmessage: ((event: MessageEvent) => void) | null }
    port2: { postMessage: (message: unknown) => void }
  }
}

/**
 * Allows asynchronous actions and macrotasks to happen between sync work.
 *
 * Prefer `MessageChannel` (avoids Chrome `setTimeout` throttling). Fall back to
 * `setImmediate` (Node) then `setTimeout(0)`.
 * Does not touch `window` at module import time.
 */
export function releaseEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const g = globalThis as typeof globalThis & {
      MessageChannel?: MessageChannelCtor
      setImmediate?: (callback: () => void) => void
    }

    if (typeof g.MessageChannel === 'function') {
      const channel = new g.MessageChannel()
      channel.port1.onmessage = () => resolve()
      channel.port2.postMessage(null)
      return
    }

    if (typeof g.setImmediate === 'function') {
      g.setImmediate(() => resolve())
      return
    }

    setTimeout(() => resolve(), 0)
  })
}
