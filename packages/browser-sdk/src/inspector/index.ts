export {
  inspectFingerprintChange,
  toCollectionInput,
  type FingerprintCollectionInput,
} from './compare.js'
export {
  formatFingerprintChangeReport,
  fingerprintChangeReportToJson,
  type FormatFingerprintChangeOptions,
} from './format.js'
export { expectedInstabilityFor, hintForChange } from './hints.js'
export {
  inspectFingerprintChangeAndFormat,
  inspectFingerprintRebuild,
  type InspectFingerprintRebuildOptions,
  type InspectFingerprintRebuildResult,
} from './inspect-rebuild.js'
export { armOf, previewComponent, stableStringify } from './preview.js'
export {
  CHANGE_INSPECTOR_DISCLAIMER,
  CHANGE_INSPECTOR_REVISION,
  type ChangeInspectorRevision,
  type ComponentArm,
  type FingerprintChangeReport,
  type InspectFingerprintChangeOptions,
  type SourceChangeKind,
  type SourceChangeRow,
} from './types.js'
