export { measureBundleSizes, DEFAULT_BUNDLE_RELATIVE_PATHS } from './bundle-sizes.js'
export { summarizeCollisions } from './entropy.js'
export {
  buildPerfEntropyReport,
  formatPerfEntropyMarkdown,
  DEFAULT_RELATIVE_EXPENSIVE_FACTOR,
} from './report.js'
export { percentile, summarizeDurations, flagRelativeExpensive } from './stats.js'
export { countVisitorIds, summarizeStability } from './stability.js'
export type {
  BundleSizeRow,
  CollectTimingSample,
  CollisionCohort,
  DomCleanupSample,
  DurationStats,
  ModeCompareRow,
  PerfEntropyReport,
  SourceCostRow,
  StabilityRun,
} from './types.js'
