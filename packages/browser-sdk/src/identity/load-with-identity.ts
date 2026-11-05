import { load, type LoadAgentOptions } from '../agent.js'
import type { Agent, GetOptions, GetResult } from '../types.js'
import { applyIdentityScope } from './apply-identity.js'
import { describeIdentityDerivation, normalizeIdentityScope } from './hash-namespaced.js'
import type { IdentityDerivationMeta, IdentityScope, NamespacedGetResult } from './types.js'

export type LoadWithIdentityScopeOptions = LoadAgentOptions & {
  /** Required opt-in identity scope. Default {@link load} ignores this. */
  readonly identity: IdentityScope
}

export type IdentityScopedAgent = {
  get(options?: Readonly<GetOptions>): Promise<NamespacedGetResult>
}

export type LoadWithIdentityScopeResult = {
  readonly agent: IdentityScopedAgent
  readonly identity: IdentityDerivationMeta
  /**
   * Underlying default agent (unsalted visitorId via {@link Agent.get}).
   * Exposed for diagnostics; prefer {@link IdentityScopedAgent.get} in apps.
   */
  readonly baselineAgent: Agent
}

/**
 * Opt-in loader: same collectors as {@link load}, but `get()` returns a
 * namespaced visitorId. Default {@link load} behavior is unchanged when unused.
 */
export async function loadWithIdentityScope(
  options: LoadWithIdentityScopeOptions,
): Promise<LoadWithIdentityScopeResult> {
  const { identity, ...loadOptions } = options
  // Validate early (empty namespace, etc.)
  normalizeIdentityScope(identity)
  const meta = describeIdentityDerivation(identity)

  const baselineAgent = await load(loadOptions)

  const agent: IdentityScopedAgent = {
    async get(getOptions: Readonly<GetOptions> = {}): Promise<NamespacedGetResult> {
      const baseline: GetResult = await baselineAgent.get(getOptions)
      return applyIdentityScope(baseline, identity)
    },
  }

  return { agent, identity: meta, baselineAgent }
}
