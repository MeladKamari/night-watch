import { Component, OnInit, inject } from '@angular/core'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>ترافیک و سرعت / Velocity</h1>
      <p class="lede">
        Behavior module — بدون keystroke telemetry. Source: <code>{{ source }}</code> · enabled={{ enabled }}
      </p>
      <div class="actions">
        <button type="button" (click)="enable()">Enable</button>
        <button type="button" (click)="record()">Record login failure</button>
        <button type="button" (click)="reload()">Refresh</button>
      </div>
      <ul>
        <li>status: {{ status }}</li>
        <li>loginFailures (1h): {{ loginFailures }}</li>
        @if (burstNote) {
          <li>{{ burstNote }}</li>
        }
        <li>events_last_hour band via smart-signal velocity_signals</li>
        <li>anti-enumeration drop after 30 probes / hour</li>
      </ul>
    </section>
  `,
  styleUrl: './pages.css',
})
export class VelocityPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  enabled = false
  status = 'disabled'
  loginFailures = 0
  burstNote: string | null = null

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    const r = await this.api.velocity()
    if (!r) {
      this.source = 'demo-fallback'
      return
    }
    this.source = 'api'
    this.enabled = r.enabled
    this.status = r.status
    this.loginFailures = r.loginFailures
    this.burstNote = r.burstNote ?? null
  }

  async enable(): Promise<void> {
    if (await this.api.enableVelocity()) await this.reload()
  }

  async record(): Promise<void> {
    if (await this.api.recordVelocity('LoginFailure')) await this.reload()
  }
}
