import { Component, OnInit, inject } from '@angular/core'
import { ConsoleApiService } from '../core/api.service'
import { collectEnvironmentProbes, probesToApiPayload } from '../core/environment-probes'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>Suspect Score</h1>
      <p class="lede">
        امتیاز heuristic وزن‌دار ۰–۱۰۰ با رسید توضیح‌پذیر؛ ادعای ML کالیبره‌شده ندارد. Source:
        <code>{{ source }}</code>
      </p>
      <button type="button" (click)="explain()">Explain from this browser (observed probes)</button>
      <div class="meter"><span [style.width.%]="score"></span></div>
      <p>
        Score: <strong>{{ score }}</strong> · Decision: <strong>{{ decision }}</strong> · Version:
        {{ version }}
      </p>
      <h2>Facets</h2>
      <ul>
        @for (f of facetEntries; track f[0]) {
          <li>{{ f[0] }}: {{ f[1] }}</li>
        }
      </ul>
      <h2>Contributions (receipt)</h2>
      <ul>
        @for (c of contributions; track c.signalId + c.reasonCode) {
          <li>
            <code>{{ c.signalId }}</code> {{ c.triState }} weight={{ c.weight }} → +{{ c.appliedPoints }}
            @if (c.reasonCode) {
              ({{ c.reasonCode }})
            }
          </li>
        }
      </ul>
      <p class="note">{{ receipt }}</p>
    </section>
  `,
  styleUrl: './pages.css',
})
export class SuspectScorePage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  score = 0
  decision = '—'
  version = '—'
  receipt = '—'
  facetEntries: [string, number][] = []
  contributions: {
    signalId: string
    weight: number
    appliedPoints: number
    triState: string
    reasonCode?: string | null
  }[] = []

  async ngOnInit(): Promise<void> {
    await this.explain()
  }

  async explain(): Promise<void> {
    const r = await this.api.explainScore(probesToApiPayload(collectEnvironmentProbes()))
    if (!r) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    this.score = r.score
    this.decision = r.decision
    this.version = r.version
    this.receipt = r.receipt
    this.facetEntries = Object.entries(r.facets ?? {})
    this.contributions = r.contributions.map((c) => ({
      signalId: c.signalId,
      weight: c.weight,
      appliedPoints: c.appliedPoints,
      triState: c.triState,
      reasonCode: c.reasonCode,
    }))
  }
}
