import {
  ENTROPY_EXPERIMENT_DISCLAIMER,
  ENTROPY_EXPERIMENTS_REVISION,
  type AcrossBrowserCollisionStats,
  type ExperimentAggregateReport,
  type ExperimentConsent,
  type ExperimentSample,
  type WithinBrowserVarianceStats,
} from './types.js'

function countIds(ids: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export function summarizeWithinBrowserVariance(
  cohort: string,
  samples: readonly ExperimentSample[],
): WithinBrowserVarianceStats {
  const ids = samples.map((s) => s.visitorId)
  const counts = countIds(ids)
  let majorityVisitorId: string | null = null
  let majorityCount = 0
  for (const [id, count] of counts) {
    if (count > majorityCount) {
      majorityCount = count
      majorityVisitorId = id
    }
  }
  return {
    cohort,
    sampleSize: samples.length,
    uniqueVisitorIds: counts.size,
    majorityShare: samples.length === 0 ? 0 : majorityCount / samples.length,
    majorityVisitorId,
    notes: [
      'Within-browser rebuild variance for a single consented cohort.',
      'majorityShare close to 1.0 suggests local stability — not cross-user uniqueness.',
    ],
  }
}

export function summarizeAcrossBrowserCollisions(
  samples: readonly ExperimentSample[],
  label = 'all-cohorts',
): AcrossBrowserCollisionStats {
  const counts = countIds(samples.map((s) => s.visitorId))
  let collisionPairsApprox = 0
  for (const count of counts.values()) {
    if (count >= 2) {
      collisionPairsApprox += (count * (count - 1)) / 2
    }
  }
  const sampleSize = samples.length
  return {
    label,
    sampleSize,
    uniqueVisitorIds: counts.size,
    collisionPairsApprox,
    uniquenessRatio: sampleSize === 0 ? 0 : counts.size / sampleSize,
    notes: [
      'Across-cohort collision numerators for this local sample only.',
      'Do not extrapolate to population false-positive rates.',
    ],
  }
}

export function buildExperimentAggregateReport(
  samples: readonly ExperimentSample[],
  consent: ExperimentConsent,
): ExperimentAggregateReport {
  const byCohort = new Map<string, ExperimentSample[]>()
  for (const sample of samples) {
    const cohort = sample.cohort?.trim() || 'default'
    const list = byCohort.get(cohort) ?? []
    list.push(sample)
    byCohort.set(cohort, list)
  }

  const cohortNames = [...byCohort.keys()].sort()
  const withinBrowser = cohortNames.map((cohort) =>
    summarizeWithinBrowserVariance(cohort, byCohort.get(cohort) ?? []),
  )

  return {
    revision: ENTROPY_EXPERIMENTS_REVISION,
    consented: true,
    purpose: consent.purpose ?? null,
    noticeVersion: consent.noticeVersion ?? null,
    sampleCount: samples.length,
    cohorts: cohortNames,
    withinBrowser,
    acrossBrowser: summarizeAcrossBrowserCollisions(samples),
    notes: [
      `Entropy experiments ${ENTROPY_EXPERIMENTS_REVISION}; default load() unchanged.`,
      'Aggregates only — raw samples are held in memory until clearSamples().',
      'No automatic network upload or persistent tracking storage by the SDK.',
    ],
    disclaimer: ENTROPY_EXPERIMENT_DISCLAIMER,
  }
}

export function experimentAggregateToJson(report: ExperimentAggregateReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
