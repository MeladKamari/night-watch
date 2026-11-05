import { Component, OnInit, inject } from '@angular/core'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>قوانین ریسک / Rules</h1>
      <p class="lede">Revision: <code>{{ revision }}</code> · Source: <code>{{ source }}</code></p>
      <pre class="code">{{ preview }}</pre>
      <div class="actions">
        <button type="button" (click)="publish()">Publish challenge≥70</button>
        <button type="button" (click)="simulate()">Simulate high score</button>
      </div>
      @if (result) {
        <p class="ok">{{ result }}</p>
      }
    </section>
  `,
  styleUrl: './pages.css',
})
export class RiskRulesPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  revision = 'none'
  preview = 'IF suspect_score >= 70 THEN challenge (server AST)'
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  result = ''

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    const doc = await this.api.rules()
    if (!doc) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    this.revision = doc.revision
    this.preview =
      doc.rules.length === 0
        ? 'No published rules for tenant'
        : doc.rules.map((r) => `${r.ruleId} p=${r.priority} → ${r.action} dryRun=${r.dryRun}`).join('\n')
  }

  async publish(): Promise<void> {
    const doc = await this.api.publishDemoRule()
    this.result = doc ? `Published ${doc.revision}` : 'Publish unavailable — offline/demo'
    await this.reload()
  }

  async simulate(): Promise<void> {
    const r = await this.api.simulateRules({
      suspect_score: 80,
      'signal.browser_bot_detection': 'detected',
    })
    this.result = r ? `Simulation: ${r.effectiveAction} @ ${r.revision}` : 'observe — offline/demo'
  }
}
