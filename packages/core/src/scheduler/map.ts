import { releaseEventLoop } from './yield.js'

/**
 * Maps items cooperatively, yielding the event loop every `loopReleaseInterval` ms
 * so rendering/network macrotasks can run between synchronous work.
 *
 * Default interval 16ms ≈ one animation frame.
 */
export async function mapWithBreaks<T, U>(
  items: readonly T[],
  callback: (item: T, index: number) => U,
  loopReleaseInterval = 16,
): Promise<U[]> {
  const results: U[] = Array.from({ length: items.length })
  let lastLoopReleaseTime = Date.now()

  for (let i = 0; i < items.length; ++i) {
    const item = items[i]
    // items is readonly T[]; index is in range — still guard for noUncheckedIndexedAccess.
    results[i] = callback(item as T, i)

    const now = Date.now()
    if (now >= lastLoopReleaseTime + loopReleaseInterval) {
      lastLoopReleaseTime = now
      await releaseEventLoop()
    }
  }

  return results
}
