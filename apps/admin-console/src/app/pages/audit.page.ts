import { Component, OnInit, inject } from '@angular/core'
import { ConsoleScreenModels } from '../core/screen-models'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>مصرف، سهمیه و حسابرسی</h1>
      <p class="lede">Source: <code>{{ source }}</code></p>
      <p>Usage: {{ usage.used }} / {{ usage.limit }} {{ usage.unit }}</p>
      <table>
        <thead>
          <tr>
            <th>At</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
          </tr>
        </thead>
        <tbody>
          @for (a of audits; track a.auditId) {
            <tr>
              <td>{{ a.at }}</td>
              <td>{{ a.actor }}</td>
              <td>{{ a.action }}</td>
              <td>{{ a.resourceType }}/{{ a.resourceId }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (audits.length === 0) {
        <p>No signed audit events yet (create a project to generate one).</p>
      }
    </section>
  `,
  styleUrl: './pages.css',
})
export class AuditPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  usage = new ConsoleScreenModels().usage()
  audits: { auditId: string; at: string; actor: string; action: string; resourceType: string; resourceId: string }[] = []
  source: 'api' | 'demo-fallback' = 'demo-fallback'

  async ngOnInit(): Promise<void> {
    const snap = await this.api.usage()
    const items = await this.api.audit()
    if (!snap && !items) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    if (snap) {
      this.usage = { used: snap.used, limit: Math.max(snap.used, 10_000), unit: snap.unit }
    }
    this.audits = (items ?? []).map((a) => ({
      auditId: a.auditId,
      at: a.at,
      actor: a.actor,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
    }))
  }
}
