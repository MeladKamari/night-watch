export {
  ProPlusDashboardClient,
  ProPlusDashboardClientError,
  type DashboardClientConfig,
  type ManagementHealth,
  type MetaResponse,
  type EventSearchHit,
  type EventSearchPage,
  type ConsoleLoginResult,
  type ApiKeyItem,
  type FraudCaseItem,
  type RulesDocument,
  type RulePublishInput,
  type WebhookItem,
  type WebhookDeliveryItem,
  type ProjectItem,
  type AuditItem,
  type UsageSnapshot,
  type GraphEdgeItem,
  type GraphSnapshot,
  type ScoreExplainResult,
  type PrivacyExportResult,
} from './client.js'

export const DASHBOARD_CLIENT_PACKAGE_NAME = '@thenightwatch/dashboard-client' as const
export const DASHBOARD_CLIENT_PACKAGE_VERSION = '1.0.0' as const
