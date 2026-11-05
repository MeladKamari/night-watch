import { Component, OnInit, inject } from '@angular/core'
import { formatTehran } from '../core/i18n-time'
import { ConsoleApiService } from '../core/api.service'
import type { ManagementHealth, MetaResponse } from '@night-watch/dashboard-client'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>داشبورد / Dashboard</h1>
      <p>Server time (Tehran): {{ nowTehran }}</p>
      <p class="lede">Risk decisions remain server-authoritative.</p>

      <h2>API health</h2>
      @if (health) {
        <ul>
          <li>Product: {{ health.productLabel }}</li>
          <li>Status: <code>{{ health.apiStatus }}</code></li>
          <li>{{ health.message }}</li>
        </ul>
      } @else {
        <p>Loading…</p>
      }

      @if (meta) {
        <h2>Meta</h2>
        <ul>
          <li>{{ meta.product }} ({{ meta.productCode }})</li>
          <li>Apple Pay: {{ meta.applePay }}</li>
          <li>Modules: {{ meta.modules.join(', ') }}</li>
        </ul>
      }
    </section>
  `,
  styleUrl: './pages.css',
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  readonly nowTehran = formatTehran(new Date().toISOString(), 'fa-IR')
  health: ManagementHealth | null = null
  meta: MetaResponse | null = null

  async ngOnInit(): Promise<void> {
    this.health = await this.api.health()
    this.meta = await this.api.meta()
  }
}
