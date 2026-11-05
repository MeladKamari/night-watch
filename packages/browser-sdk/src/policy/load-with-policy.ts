import { load, type LoadAgentOptions } from '../agent.js'
import type { Agent } from '../types.js'
import { assertConsentAllowsCollection } from './consent.js'
import { assertKnownCategories } from './resolve-policy.js'
import { describePolicyImpact, resolveExcludedSources } from './resolve-policy.js'
import type { CollectionPolicy, PolicyResolution } from './types.js'

export type LoadWithCollectionPolicyOptions = LoadAgentOptions & {
  /**
   * Required opt-in policy. Default {@link load} ignores policies entirely.
   */
  readonly policy: CollectionPolicy
}

export type LoadWithCollectionPolicyResult = {
  readonly agent: Agent
  readonly resolution: PolicyResolution
}

/**
 * Opt-in entry: enforces consent, resolves category/source exclusions, then
 * delegates to {@link load}. Disabled collectors are never started
 * (`excludeSources` path inside `loadSources`).
 *
 * Default fingerprint behavior via {@link load} remains unchanged when this
 * function is not used.
 */
export async function loadWithCollectionPolicy(
  options: LoadWithCollectionPolicyOptions,
): Promise<LoadWithCollectionPolicyResult> {
  const { policy, ...loadOptions } = options

  assertKnownCategories(policy.omitCategories ?? [])
  assertKnownCategories(policy.allowCategories ?? [])
  assertConsentAllowsCollection(policy.consent)

  const resolution = describePolicyImpact(policy)
  const excluded = resolveExcludedSources(policy)
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
