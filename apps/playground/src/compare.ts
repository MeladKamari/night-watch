import type { PlaygroundSnapshot } from './snapshot.js'

export type RunComparison = {
  readonly visitorIdChanged: boolean
  readonly previousVisitorId: string
  readonly currentVisitorId: string
  readonly changedKeys: readonly string[]
  readonly onlyInPrevious: readonly string[]
  readonly onlyInCurrent: readonly string[]
  readonly confidenceScoreDelta: number
}

/**
 * Compares two independent collection snapshots (repeat-run / A-B view).
 * Diff is display-only; it does not re-hash or mutate components.
 */
export function compareSnapshots(
  previous: PlaygroundSnapshot,
  current: PlaygroundSnapshot,
): RunComparison {
  const prevMap = new Map(previous.signals.map((row) => [row.key, row]))
  const currMap = new Map(current.signals.map((row) => [row.key, row]))

  const onlyInPrevious: string[] = []
  const onlyInCurrent: string[] = []
  const changedKeys: string[] = []

  for (const key of prevMap.keys()) {
    if (!currMap.has(key)) {
      onlyInPrevious.push(key)
    }
  }
  for (const key of currMap.keys()) {
    if (!prevMap.has(key)) {
      onlyInCurrent.push(key)
      continue
    }
    const a = prevMap.get(key)!
    const b = currMap.get(key)!
    if (a.kind !== b.kind || a.summary !== b.summary) {
      changedKeys.push(key)
    }
  }

  onlyInPrevious.sort()
  onlyInCurrent.sort()
  changedKeys.sort()

  return {
    visitorIdChanged: previous.visitorId !== current.visitorId,
    previousVisitorId: previous.visitorId,
    currentVisitorId: current.visitorId,
    changedKeys,
    onlyInPrevious,
    onlyInCurrent,
    confidenceScoreDelta: current.confidenceScore - previous.confidenceScore,
  }
}
