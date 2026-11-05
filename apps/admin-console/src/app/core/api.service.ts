import { Injectable, InjectionToken, inject } from '@angular/core'
import {
  ProPlusDashboardClient,
  ProPlusDashboardClientError,
  type ApiKeyItem,
  type AuditItem,
  type ConsoleLoginResult,
  type EventSearchPage,
  type FraudCaseItem,
  type GraphSnapshot,
  type ManagementHealth,
  type MetaResponse,
  type ProjectItem,
  type RulesDocument,
  type ScoreExplainResult,
  type UsageSnapshot,
  type WebhookDeliveryItem,
  type WebhookItem,
} from '@night-watch/dashboard-client'
import { SessionStore } from './session.store'

export type ConsoleApiConfig = {
  baseUrl: string
  tenantId: string
  networkEnabled: boolean
}

export const NIGHT_WATCH_API_CONFIG = new InjectionToken<ConsoleApiConfig>('NIGHT_WATCH_API_CONFIG')

@Injectable({ providedIn: 'root' })
export class ConsoleApiService {
  private readonly config = inject(NIGHT_WATCH_API_CONFIG)
  private readonly sessions = inject(SessionStore)
  private client: ProPlusDashboardClient | null = null

  private getClient(): ProPlusDashboardClient {
    if (!this.client) {
      this.client = new ProPlusDashboardClient({
        baseUrl: this.config.baseUrl,
        tenantId: this.config.tenantId,
        credentials: 'include',
      })
      const existing = this.sessions.session() ?? this.sessions.restore()
      if (existing) {
        this.client.setSession(existing.sessionId, existing.csrfToken, existing.tenantId)
      }
    }
    return this.client
  }

  get networkEnabled(): boolean {
    return this.config.networkEnabled
  }

  async login(username: string, password: string): Promise<ConsoleLoginResult> {
    const result = await this.getClient().login(username, password)
    this.sessions.set(result)
    return result
  }

  async logout(): Promise<void> {
    if (this.config.networkEnabled) {
      try {
        await this.getClient().logout()
      } catch {
        /* ignore */
      }
    }
    this.getClient().clearSession()
    this.sessions.clear()
  }

  async health(): Promise<ManagementHealth> {
    if (!this.config.networkEnabled) return this.getClient().describeLocalHealth()
    try {
      return await this.getClient().ping()
    } catch (err) {
      if (err instanceof ProPlusDashboardClientError) {
        return {
          productLabel: 'Night Watch (independent)',
          apiStatus: 'unavailable',
          message: `${err.code}: ${err.message}`,
        }
      }
      throw err
    }
  }

  async meta(): Promise<MetaResponse | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().getMeta()
    } catch {
      return null
    }
  }

  async events(q: { visitorId?: string; eventId?: string; limit?: number } = {}): Promise<EventSearchPage | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().listEvents(q)
    } catch {
      return null
    }
  }

  async keys(): Promise<ApiKeyItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      const page = await this.getClient().listKeys('dev')
      return [...(page.items ?? [])]
    } catch {
      return null
    }
  }

  async createKey(kind = 'Public'): Promise<ApiKeyItem | null> {
    if (!this.config.networkEnabled) return null
    try {
      const scopes = kind.toLowerCase() === 'public' ? ['collect:ingest'] : ['events:read']
      return await this.getClient().createKey({ kind, environmentId: 'dev', scopes })
    } catch {
      return null
    }
  }

  async revokeKey(keyId: string): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().revokeKey(keyId)
      return true
    } catch {
      return false
    }
  }

  async cases(): Promise<FraudCaseItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      const page = await this.getClient().listCases()
      return [...page.items]
    } catch {
      return null
    }
  }

  async openCase(highRisk = false): Promise<FraudCaseItem | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().openCase({ highRisk, evidence: ['console_open'] })
    } catch {
      return null
    }
  }

  async rules(): Promise<RulesDocument | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().getRules()
    } catch {
      return null
    }
  }

  async simulateRules(facts: Record<string, unknown>): Promise<{ effectiveAction: string; revision: string } | null> {
    if (!this.config.networkEnabled) return null
    try {
      const r = await this.getClient().simulateRules(facts)
      return { effectiveAction: r.effectiveAction, revision: r.revision }
    } catch {
      return null
    }
  }

  async publishDemoRule(): Promise<RulesDocument | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().publishRules({
        revision: 'console_' + Date.now(),
        rules: [
          {
            ruleId: 'challenge-high-score',
            priority: 100,
            action: 'Challenge',
            dryRun: false,
            when: { field: 'suspect_score', op: 'Gte', value: 70 },
          },
        ],
      })
    } catch {
      return null
    }
  }

  async webhooks(): Promise<WebhookItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listWebhooks('dev')).items]
    } catch {
      return null
    }
  }

  async createWebhook(targetUrl: string): Promise<WebhookItem | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().createWebhook({
        targetUrl,
        environmentId: 'dev',
        eventFilters: ['event.identification'],
      })
    } catch {
      return null
    }
  }

  async webhookDeliveries(): Promise<WebhookDeliveryItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listWebhookDeliveries()).items]
    } catch {
      return null
    }
  }

  async projects(): Promise<ProjectItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listProjects()).items]
    } catch {
      return null
    }
  }

  async createProject(name: string): Promise<ProjectItem | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().createProject(name)
    } catch {
      return null
    }
  }

  async patchProject(
    projectId: string,
    input: { name?: string; retentionDays?: number; ifMatchRevision: number },
  ): Promise<ProjectItem | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().patchProject(projectId, input)
    } catch {
      return null
    }
  }

  async audit(): Promise<AuditItem[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listAudit()).items]
    } catch {
      return null
    }
  }

  async usage(projectId = 'default', environmentId = 'dev'): Promise<UsageSnapshot | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().getUsage(projectId, environmentId)
    } catch {
      return null
    }
  }

  async graph(visitorId?: string): Promise<GraphSnapshot | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().getGraph(visitorId)
    } catch {
      return null
    }
  }

  async addGraphEdge(from: string, to: string, confidence = 0.7): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().addGraphEdge({ from, to, edgeType: 'link', confidence })
      return true
    } catch {
      return false
    }
  }

  async explainScore(input: Record<string, unknown> = {}): Promise<ScoreExplainResult | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().explainScore(input)
    } catch {
      return null
    }
  }

  async privacyExport(visitorId: string): Promise<unknown | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().privacyExport(visitorId)
    } catch {
      return null
    }
  }

  async privacyErase(visitorId: string, reason: string): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().privacyErase(visitorId, reason)
      return true
    } catch {
      return false
    }
  }

  async privacyTombstones(): Promise<unknown[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listPrivacyTombstones()).items]
    } catch {
      return null
    }
  }

  async privacyJobs(): Promise<unknown[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listPrivacyJobs()).items]
    } catch {
      return null
    }
  }

  async enqueueWebhook(subscriptionId: string): Promise<string | null> {
    if (!this.config.networkEnabled) return null
    try {
      return (await this.getClient().enqueueWebhook(subscriptionId)).deliveryId
    } catch {
      return null
    }
  }

  async processWebhooks(): Promise<{ processed: number; deadLetter: number } | null> {
    if (!this.config.networkEnabled) return null
    try {
      return await this.getClient().processWebhooks()
    } catch {
      return null
    }
  }

  async replayWebhook(deliveryId: string): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().replayWebhookDelivery(deliveryId)
      return true
    } catch {
      return false
    }
  }

  async verifyBot(userAgent: string): Promise<{ classification: string; status: string; evidence: string[] } | null> {
    if (!this.config.networkEnabled) return null
    try {
      const r = await this.getClient().verifyBot(userAgent)
      return { classification: r.classification, status: r.status, evidence: [...r.evidence] }
    } catch {
      return null
    }
  }

  async enableVelocity(): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().enableVelocity()
      return true
    } catch {
      return false
    }
  }

  async recordVelocity(type = 'LoginFailure'): Promise<boolean> {
    if (!this.config.networkEnabled) return false
    try {
      await this.getClient().recordVelocity({ accountHash: 'acc_demo', type })
      return true
    } catch {
      return false
    }
  }

  async velocity(): Promise<{
    enabled: boolean
    status: string
    loginFailures: number
    burstNote?: string | null
  } | null> {
    if (!this.config.networkEnabled) return null
    try {
      const r = await this.getClient().getVelocity()
      return {
        enabled: r.enabled,
        status: r.status,
        loginFailures: r.loginFailures,
        burstNote: r.burstNote,
      }
    } catch {
      return null
    }
  }

  async signalCatalog(): Promise<{ signalId: string; channel: string; evaluable: boolean }[] | null> {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().listSignalCatalog()).items]
    } catch {
      return null
    }
  }

  async evaluateSignals(input: Record<string, unknown> = {}): Promise<
    | {
        signalId: string
        status: string
        triState: string
        value?: string | null
      }[]
    | null
  > {
    if (!this.config.networkEnabled) return null
    try {
      return [...(await this.getClient().evaluateSignals(input)).items]
    } catch {
      return null
    }
  }
}
