import { DEFERRED_NATIVE_SIGNAL_CATALOG, WEB_SMART_SIGNAL_IDS } from './console-modules.js'

export type TenantEnvConfig = {
  tenantId: string
  projectId: string
  environment: 'dev' | 'stage' | 'prod'
  retentionDays: number
}

export type ApiKeyRow = { keyId: string; kind: 'public' | 'secret'; masked: string; status: string }

export type EventRow = { eventId: string; visitorId: string; atIso: string; label?: string }

export type FraudCaseRow = { caseId: string; status: string; assignee: string }

export type UsageQuota = { used: number; limit: number; unit: string }

/** Lightweight view-models for console screens (STEP 101–114). */
export class ConsoleScreenModels {
  tenantConfig(): TenantEnvConfig {
    return { tenantId: 'tenant_demo', projectId: 'proj_demo', environment: 'dev', retentionDays: 90 }
  }

  apiKeys(): ApiKeyRow[] {
    return [
      { keyId: 'k1', kind: 'public', masked: 'pk_****abcd', status: 'active' },
      { keyId: 'k2', kind: 'secret', masked: 'sk_****wxyz', status: 'revoked' },
    ]
  }

  events(): EventRow[] {
    return [{ eventId: 'evt_1', visitorId: 'v_abc', atIso: new Date().toISOString(), label: 'login' }]
  }

  smartSignalsPanel(): { web: readonly string[]; deferredNative: readonly string[] } {
    return { web: WEB_SMART_SIGNAL_IDS, deferredNative: DEFERRED_NATIVE_SIGNAL_CATALOG }
  }

  fraudCases(): FraudCaseRow[] {
    return [{ caseId: 'case_1', status: 'open', assignee: 'analyst_a' }]
  }

  usage(): UsageQuota {
    return { used: 1200, limit: 10000, unit: 'identify_calls' }
  }

  /** Frontend never owns deny/allow authority. */
  consumeStepUpHint(serverAction: string): 'show_challenge_ui' | 'observe_only' | 'ignore' {
    if (serverAction === 'challenge') return 'show_challenge_ui'
    if (serverAction === 'observe' || serverAction === 'log') return 'observe_only'
    return 'ignore'
  }
}
