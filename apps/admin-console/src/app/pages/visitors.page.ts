import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>پروفایل بازدیدکننده و گراف هویت</h1>
      <p class="lede">
        یال‌ها investigation lead هستند (half-life {{ halfLife }}d) — نه حکم قطعی تقلب. Source:
        <code>{{ source }}</code>
      </p>
      <form class="grid" (ngSubmit)="addEdge()">
        <label>From <input [(ngModel)]="fromId" name="from" /></label>
        <label>To <input [(ngModel)]="toId" name="to" /></label>
        <button type="submit">Add hypothesis edge</button>
      </form>
      <div class="graph">
        @for (e of edges; track e.edgeId) {
          <div class="node">{{ e.from }}</div>
          <div class="edge">{{ e.edgeType }} · conf {{ e.effectiveConfidence }} ({{ e.decayNote }})</div>
          <div class="node">{{ e.to }}</div>
        }
      </div>
      @if (edges.length === 0) {
        <p class="note">No active edges. Add a hypothesis or enable API.</p>
      }
      <h2>Ring leads</h2>
      <ul>
        @for (l of leads; track l.componentId) {
          <li><code>{{ l.componentId }}</code> {{ l.status }} score={{ l.score }} nodes={{ l.nodeIds.join(', ') }}</li>
        }
      </ul>
      <p class="note">{{ disclaimer }}</p>
    </section>
  `,
  styleUrl: './pages.css',
})
export class VisitorsPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  halfLife = 180
  fromId = 'device_a'
  toId = 'acc_1'
  edges: {
    edgeId: string
    from: string
    to: string
    edgeType: string
    effectiveConfidence: number
    decayNote: string
  }[] = []
  leads: { componentId: string; status: string; score: number; nodeIds: string[] }[] = []
  disclaimer = 'CGNAT / shared ISP edges are suppressed in the risk graph service.'

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    const snap = await this.api.graph()
    if (!snap) {
      this.source = 'demo-fallback'
      this.edges = [
        {
          edgeId: 'demo',
          from: 'device_a',
          to: 'acc_1',
          edgeType: 'link',
          effectiveConfidence: 0.9,
          decayNote: 'demo',
        },
      ]
      return
    }
    this.source = 'api'
    this.halfLife = snap.halfLifeDays
    this.disclaimer = snap.disclaimer
    this.edges = snap.edges.map((e) => ({
      edgeId: e.edgeId,
      from: e.from,
      to: e.to,
      edgeType: e.edgeType,
      effectiveConfidence: e.effectiveConfidence,
      decayNote: e.decayNote,
    }))
    this.leads = snap.ringLeads.map((l) => ({
      componentId: l.componentId,
      status: l.status,
      score: l.score,
      nodeIds: [...l.nodeIds],
    }))
  }

  async addEdge(): Promise<void> {
    if (!(await this.api.addGraphEdge(this.fromId, this.toId))) return
    await this.reload()
  }
}
