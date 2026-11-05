export {
  ProWebAgent,
  createProWebAgent,
} from './agent.js'

export {
  PRO_WEB_AGENT_PROTOCOL_VERSION,
  type GetCallOptions,
  type ProAgentEvent,
  type ProAgentEventType,
  type ProAgentOptions,
  type ProAgentState,
  type ProVisitorData,
} from './types.js'

export {
  FirstPartyTransport,
  type TransportConfig,
  type TransportProblem,
  type TransportResult,
} from './transport.js'

export {
  CollectionBudgetRunner,
  importLocalChunk,
  type BudgetOutcome,
  type CollectionBudgetConfig,
  type SignalBudget,
} from './budgets.js'

export {
  BrowserCollectionPolicy,
  type CollectionPolicyState,
  type PolicyChangeHandler,
  type PolicyDecision,
} from './policy.js'

export { SpaLifecycleController, type SpaIdentifyFn } from './spa.js'
export {
  NonceReceiptClient,
  ServerNonceStore,
  type Challenge,
  type ReceiptStatus,
} from './nonce-receipt.js'
export {
  BoundedRetryController,
  type BoundedRetryOptions,
  type RetryQueueItem,
  type RetryState,
} from './retry-offline.js'

export {
  CSP_RECOMMENDATIONS,
  assertNoDynamicCodePatterns,
  reducedPermissionFallback,
} from './csp.js'

export {
  isBrowserRuntime,
  createAgentBrowserOnly,
  createReactAgentHook,
  createVueProAgent,
  AngularProAgentService,
  loadProAgentForNext,
} from './frameworks.js'

export {
  buildRedactedDiagnostics,
  defaultAvailabilityStub,
  type RedactedDiagnosticEvent,
  type SourceAvailability,
} from './diagnostics.js'

export {
  UNSUPPORTED_NATIVE_FEATURES,
  runBrowserReleaseGate,
  type ReleaseGateReport,
} from './release-gate.js'

export const WEB_AGENT_PACKAGE_NAME = '@night-watch/web-agent' as const
export const WEB_AGENT_PACKAGE_VERSION = '1.0.0' as const
