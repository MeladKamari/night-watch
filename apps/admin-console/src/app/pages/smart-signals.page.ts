import { Component, OnInit, inject } from '@angular/core'
import { ConsoleScreenModels } from '../core/screen-models'
import { ConsoleApiService } from '../core/api.service'
import { collectEnvironmentProbes, probesToApiPayload } from '../core/environment-probes'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>Smart Signals (۲۱ وب + ۱۰ native معوق)</h1>
      <p class="lede">Source: <code>{{ source }}</code></p>
      <button type="button" (click)="evaluate()">Evaluate from this browser (observed probes)</button>
      <div class="cols">
        <div>
          <h2>Web / server ({{ panel.web.length }})</h2>
          <ul>
            @for (id of panel.web; track id) {
              <li><code>{{ id }}</code></li>
            }
          </ul>
        </div>
        <div>
          <h2>Deferred native ({{ panel.deferredNative.length }})</h2>
          <ul>
            @for (id of panel.deferredNative; track id) {
              <li><code>{{ id }}</code> — never faked in JS</li>
            }
          </ul>
        </div>
      </div>
      @if (outcomes.length) {
        <h2>Live evaluate</h2>
        <ul>
          @for (o of outcomes; track o.signalId) {
            <li>
              <code>{{ o.signalId }}</code> {{ o.status }}/{{ o.triState }}
              @if (o.value) {
                = {{ o.value }}
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styleUrl: './pages.css',
})
export class SmartSignalsPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  panel = new ConsoleScreenModels().smartSignalsPanel()
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  outcomes: { signalId: string; status: string; triState: string; value?: string | null }[] = []

  async ngOnInit(): Promise<void> {
    const catalog = await this.api.signalCatalog()
    if (catalog) {
      this.source = 'api'
      this.panel = {
        web: catalog.filter((c) => c.evaluable).map((c) => c.signalId),
        deferredNative: catalog.filter((c) => !c.evaluable).map((c) => c.signalId),
      }
    }
  }

  async evaluate(): Promise<void> {
    const items = await this.api.evaluateSignals(probesToApiPayload(collectEnvironmentProbes()))
    if (!items) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    this.outcomes = items
  }
}
