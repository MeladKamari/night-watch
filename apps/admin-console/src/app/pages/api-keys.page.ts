import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleScreenModels, type ApiKeyRow } from '../core/screen-models'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>کلیدها و وب‌هوک / API keys</h1>
      <p class="lede">Source: <code>{{ source }}</code> — secret فقط یک‌بار بعد از create/rotate.</p>
      <button type="button" (click)="create()">Create public key</button>
      @if (secretOnce) {
        <p class="ok">Secret once: <code>{{ secretOnce }}</code></p>
      }
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Kind</th>
            <th>Masked</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (k of keys; track k.keyId) {
            <tr>
              <td>{{ k.keyId }}</td>
              <td>{{ k.kind }}</td>
              <td><code>{{ k.masked }}</code></td>
              <td>{{ k.status }}</td>
              <td>
                @if (k.status === 'active') {
                  <button type="button" (click)="revoke(k.keyId)">Revoke</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>

      <h2>Webhooks</h2>
      <form class="grid" (ngSubmit)="addWebhook()">
        <label>Target URL <input [(ngModel)]="webhookUrl" name="whUrl" placeholder="http://127.0.0.1:9999/hook" /></label>
        <button type="submit">Create webhook</button>
      </form>
      @if (webhookSecret) {
        <p class="ok">Webhook secret once: <code>{{ webhookSecret }}</code></p>
      }
      <ul>
        @for (w of webhooks; track w.subscriptionId) {
          <li>
            <code>{{ w.subscriptionId }}</code> → {{ w.targetUrl }}
            <button type="button" (click)="enqueue(w.subscriptionId)">Enqueue</button>
          </li>
        }
      </ul>
      <div class="actions">
        <button type="button" (click)="process()">Process pending</button>
        @if (processNote) {
          <span class="ok">{{ processNote }}</span>
        }
      </div>
      <h3>Deliveries / dead-letter</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Error</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (d of deliveries; track d.deliveryId) {
            <tr>
              <td><code>{{ d.deliveryId }}</code></td>
              <td>{{ d.status }}</td>
              <td>{{ d.attempts }}</td>
              <td>{{ d.lastError || '—' }}</td>
              <td>
                @if (d.status === 'dead' || d.status === 'circuit_open') {
                  <button type="button" (click)="replay(d.deliveryId)">Replay</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styleUrl: './pages.css',
})
export class ApiKeysPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  keys: ApiKeyRow[] = new ConsoleScreenModels().apiKeys()
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  secretOnce = ''
  webhookUrl = 'http://127.0.0.1:9999/hook'
  webhookSecret = ''
  processNote = ''
  webhooks: { subscriptionId: string; targetUrl: string }[] = []
  deliveries: { deliveryId: string; status: string; attempts: number; lastError?: string | null }[] = []

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    if (!this.api.networkEnabled) {
      this.source = 'demo-fallback'
      this.keys = new ConsoleScreenModels().apiKeys()
      this.webhooks = []
      this.deliveries = []
      return
    }

    const items = await this.api.keys()
    // Network mode: keep api source even when list is empty; only fall back if request failed.
    if (items === null) {
      this.source = 'demo-fallback'
      this.keys = new ConsoleScreenModels().apiKeys()
      this.webhooks = []
      this.deliveries = []
      return
    }
    this.source = 'api'
    this.keys = items.map((k) => {
      const kindRaw = String(k.kind ?? k.Kind ?? '')
      const kind =
        kindRaw === '0' || kindRaw.toLowerCase().includes('public')
          ? 'public'
          : kindRaw === '1' || kindRaw.toLowerCase().includes('server')
            ? 'secret'
            : 'secret'
      return {
        keyId: k.keyId ?? k.KeyId ?? 'unknown',
        kind,
        masked: k.masked ?? `${k.prefix ?? k.Prefix ?? ''}****`,
        status: k.status ?? (k.Revoked ? 'revoked' : 'active'),
      }
    })
    const wh = await this.api.webhooks()
    this.webhooks = (wh ?? []).map((w) => ({ subscriptionId: w.subscriptionId, targetUrl: w.targetUrl }))
    const del = await this.api.webhookDeliveries()
    this.deliveries = (del ?? []).map((d) => ({
      deliveryId: d.deliveryId,
      status: d.status,
      attempts: d.attempts,
      lastError: d.lastError,
    }))
  }

  async create(): Promise<void> {
    const created = await this.api.createKey('Public')
    if (!created) return
    this.secretOnce = created.secretOnce ?? ''
    await this.reload()
  }

  async revoke(keyId: string): Promise<void> {
    if (!(await this.api.revokeKey(keyId))) return
    await this.reload()
  }

  async addWebhook(): Promise<void> {
    const created = await this.api.createWebhook(this.webhookUrl)
    if (!created) return
    this.webhookSecret = created.secretOnce ?? ''
    await this.reload()
  }

  async enqueue(subscriptionId: string): Promise<void> {
    const id = await this.api.enqueueWebhook(subscriptionId)
    this.processNote = id ? `Enqueued ${id}` : 'Enqueue failed'
    await this.reload()
  }

  async process(): Promise<void> {
    const r = await this.api.processWebhooks()
    this.processNote = r ? `Processed ${r.processed}; dead-letter ${r.deadLetter}` : 'Process failed'
    await this.reload()
  }

  async replay(deliveryId: string): Promise<void> {
    if (!(await this.api.replayWebhook(deliveryId))) return
    this.processNote = `Replayed ${deliveryId}`
    await this.reload()
  }
}
