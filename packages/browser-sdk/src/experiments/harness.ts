import { load, type LoadAgentOptions } from '../agent.js'
import { ExperimentConsentError } from './errors.js'
import {
  buildExperimentAggregateReport,
  experimentAggregateToJson,
} from './aggregate.js'
import {
  ENTROPY_EXPERIMENTS_REVISION,
  type ExperimentAggregateReport,
  type ExperimentConsent,
  type ExperimentSample,
} from './types.js'

function assertConsentAllows(consent: ExperimentConsent): void {
  if (consent.status === 'granted') return
  throw new ExperimentConsentError(
    consent.status,
    `Entropy experiment requires consent.status === "granted" (got "${consent.status}")`,
  )
}

export type EntropyExperimentHarnessOptions = {
  readonly consent: ExperimentConsent
  /** Soft cap on retained in-memory samples (default 500). */
  readonly maxSamples?: number
}

/**
 * Opt-in, consent-gated entropy experiment session.
 * Holds samples **in memory only**; call {@link EntropyExperimentHarness.clearSamples}
 * or {@link EntropyExperimentHarness.dispose} to delete. Never opens network sockets.
 */
export class EntropyExperimentHarness {
  readonly revision = ENTROPY_EXPERIMENTS_REVISION
  private readonly consent: ExperimentConsent
  private readonly maxSamples: number
  private samples: ExperimentSample[] = []
  private disposed = false

  constructor(options: EntropyExperimentHarnessOptions) {
    assertConsentAllows(options.consent)
    this.consent = { ...options.consent }
    const max = options.maxSamples === undefined ? 500 : options.maxSamples
    if (!Number.isFinite(max) || max < 1) {
      throw new TypeError('maxSamples must be a finite number ≥ 1')
    }
    this.maxSamples = Math.floor(max)
  }

  get sampleCount(): number {
    return this.samples.length
  }

  /** Uncertainty / deletion control — drops all retained samples. */
  clearSamples(): void {
    this.samples = []
  }

  /** Alias for clearSamples + mark unusable until a new harness is created. */
  dispose(): void {
    this.clearSamples()
    this.disposed = true
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new ExperimentConsentError('withdrawn', 'Harness was disposed; create a new session')
    }
    assertConsentAllows(this.consent)
  }

  /**
   * Record an already-collected visitorId (lab import). Does not collect by itself.
   */
  recordSample(sample: ExperimentSample): void {
    this.assertActive()
    if (typeof sample.visitorId !== 'string' || !/^[0-9a-f]{32}$/i.test(sample.visitorId)) {
      throw new TypeError('sample.visitorId must be a 32-char hex string')
    }
    if (this.samples.length >= this.maxSamples) {
      throw new Error(`maxSamples (${this.maxSamples}) reached; clearSamples() or raise the cap`)
    }
    this.samples.push({
      visitorId: sample.visitorId.toLowerCase(),
      collectedAt: sample.collectedAt ?? new Date().toISOString(),
      ...(sample.cohort !== undefined ? { cohort: sample.cohort } : {}),
      ...(sample.durationMs !== undefined ? { durationMs: sample.durationMs } : {}),
    })
  }

  /**
   * Collect N rebuilds via {@link load} / `get` for within-browser variance.
   * Default fingerprint algorithm unchanged; this only samples results.
   */
  async collectRebuilds(
    times: number,
    loadOptions: LoadAgentOptions = {},
    cohort = 'rebuild',
  ): Promise<readonly ExperimentSample[]> {
    this.assertActive()
    if (!Number.isFinite(times) || times < 1) {
      throw new TypeError('times must be a finite number ≥ 1')
    }
    const n = Math.floor(times)
    const agent = await load(loadOptions)
    const collected: ExperimentSample[] = []
    for (let i = 0; i < n; i++) {
      const started = Date.now()
      const result = await agent.get()
      const sample: ExperimentSample = {
        visitorId: result.visitorId,
        cohort,
        durationMs: Date.now() - started,
        collectedAt: new Date().toISOString(),
      }
      this.recordSample(sample)
      collected.push(sample)
    }
    return collected
  }

  aggregate(): ExperimentAggregateReport {
    this.assertActive()
    return buildExperimentAggregateReport(this.samples, this.consent)
  }

  aggregateJson(): string {
    return experimentAggregateToJson(this.aggregate())
  }

  /** Snapshot copy of retained samples (for explicit local export by the integrator). */
  listSamples(): ExperimentSample[] {
    this.assertActive()
    return this.samples.map((s) => ({ ...s }))
  }
}

export function createEntropyExperimentHarness(
  options: EntropyExperimentHarnessOptions,
): EntropyExperimentHarness {
  return new EntropyExperimentHarness(options)
}
