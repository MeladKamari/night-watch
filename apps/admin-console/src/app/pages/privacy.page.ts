import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>حریم خصوصی / Privacy (DPO)</h1>
      <p class="lede">Export و erase مبتنی بر visitorId — نقش Administrator/DPO. Source: <code>{{ source }}</code></p>
      <form class="grid" (ngSubmit)="runExport()">
        <label>Visitor ID <input [(ngModel)]="visitorId" name="vid" required /></label>
        <label>Erase reason <input [(ngModel)]="reason" name="reason" /></label>
        <button type="button" (click)="runExport()">Export</button>
        <button type="button" (click)="runErase()">Erase + graph cascade</button>
      </form>
      @if (message) {
        <p class="ok">{{ message }}</p>
      }
      @if (exportPreview) {
        <pre class="code">{{ exportPreview }}</pre>
      }
      <h2>Tombstones</h2>
      <p>{{ tombstones.length }} recorded</p>
      <h2>Erasure jobs</h2>
      <p>{{ jobs.length }} queued/done</p>
    </section>
  `,
  styleUrl: './pages.css',
})
export class PrivacyPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  visitorId = 'vis_demo'
  reason = 'dpo_erasure'
  message = ''
  exportPreview = ''
  tombstones: unknown[] = []
  jobs: unknown[] = []

  async ngOnInit(): Promise<void> {
    await this.reloadMeta()
  }

  async reloadMeta(): Promise<void> {
    const t = await this.api.privacyTombstones()
    const j = await this.api.privacyJobs()
    if (t === null && j === null) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    this.tombstones = t ?? []
    this.jobs = j ?? []
  }

  async runExport(): Promise<void> {
    const body = await this.api.privacyExport(this.visitorId)
    if (!body) {
      this.message = 'Export unavailable — offline or forbidden'
      return
    }
    this.message = 'Export OK'
    this.exportPreview = JSON.stringify(body, null, 2).slice(0, 2000)
    await this.reloadMeta()
  }

  async runErase(): Promise<void> {
    const ok = await this.api.privacyErase(this.visitorId, this.reason)
    this.message = ok ? 'Erase requested (+ graph cascade)' : 'Erase failed — offline or forbidden'
    await this.reloadMeta()
  }
}
