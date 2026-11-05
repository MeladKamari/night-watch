import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleScreenModels, type EventRow } from '../core/screen-models'
import { formatTehran } from '../core/i18n-time'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>کاوش رویداد / Event explorer</h1>
      <p class="lede">
        Source:
        <code>{{ source }}</code>
        @if (error) {
          — {{ error }}
        }
      </p>
      <label class="search">Search <input [(ngModel)]="q" name="q" placeholder="eventId / visitorId / label" /></label>
      <button type="button" (click)="reload()">Refresh</button>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Visitor</th>
            <th>Tehran time</th>
            <th>Label / band</th>
          </tr>
        </thead>
        <tbody>
          @for (e of filtered; track e.eventId) {
            <tr>
              <td><code>{{ e.eventId }}</code></td>
              <td><code>{{ e.visitorId }}</code></td>
              <td>{{ format(e.atIso) }}</td>
              <td>{{ e.label || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styleUrl: './pages.css',
})
export class EventsPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  private rows: EventRow[] = new ConsoleScreenModels().events()
  q = ''
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  error = ''
  format = (iso: string) => formatTehran(iso, 'fa-IR')

  get filtered(): EventRow[] {
    const q = this.q.trim().toLowerCase()
    if (!q) return this.rows
    return this.rows.filter(
      (e) =>
        e.eventId.toLowerCase().includes(q) ||
        e.visitorId.toLowerCase().includes(q) ||
        (e.label?.toLowerCase().includes(q) ?? false),
    )
  }

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    this.error = ''
    const page = await this.api.events({ limit: 50 })
    if (!page) {
      this.source = 'demo-fallback'
      this.rows = new ConsoleScreenModels().events()
      this.error = 'API unavailable — showing demo rows'
      return
    }
    this.source = 'api'
    this.rows = page.items.map((i) => ({
      eventId: i.eventId,
      visitorId: i.visitorId,
      atIso: i.createdAt,
      label: i.riskBand || i.signalStatus,
    }))
  }
}
