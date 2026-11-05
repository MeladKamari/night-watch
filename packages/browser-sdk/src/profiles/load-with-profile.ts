import { load, type LoadAgentOptions } from '../agent.js'
import type { Agent } from '../types.js'
import {
  assertReliabilityProfileId,
  resolveReliabilityProfile,
} from './resolve-profile.js'
import type { ReliabilityProfileId, ReliabilityProfileResolution } from './types.js'

export type LoadWithReliabilityProfileOptions = LoadAgentOptions & {
  /**
   * Required opt-in profile id. Default {@link load} ignores profiles entirely.
   */
  readonly profile: ReliabilityProfileId | string
}

export type LoadWithReliabilityProfileResult = {
  readonly agent: Agent
  readonly resolution: ReliabilityProfileResolution
}

/**
 * Opt-in entry: resolves a reliability profile to `excludeSources`, then
 * delegates to {@link load}. Excluded collectors are never started.
 *
 * Default fingerprint behavior via {@link load} remains unchanged when this
 * function is not used. Profile `diagnostic` includes all 41 sources (same
 * selectors as default load) and is for labeled diagnostics only.
 */
export async function loadWithReliabilityProfile(
  options: LoadWithReliabilityProfileOptions,
): Promise<LoadWithReliabilityProfileResult> {
  const { profile: profileRaw, ...loadOptions } = options
  const profileId = assertReliabilityProfileId(String(profileRaw))
  const resolution = resolveReliabilityProfile(profileId)
  const excluded = resolution.manifest.excludedSources
  const mergedExclude = uniqueMerge(loadOptions.excludeSources ?? [], excluded)

  const agent = await load({
    ...loadOptions,
    excludeSources: mergedExclude,
  })

  return { agent, resolution }
}

function uniqueMerge(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of [...a, ...b]) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}
