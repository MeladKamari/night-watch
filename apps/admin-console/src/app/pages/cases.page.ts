import { Component, OnInit, inject } from '@angular/core'
import { ConsoleScreenModels, type FraudCaseRow } from '../core/screen-models'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>پرونده تقلب / Fraud cases</h1>
      <p class="lede">Source: <code>{{ source }}</code> — maker-checker روی سرور.</p>
      <button type="button" (click)="open()">Open case</button>
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Status</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          @for (c of cases; track c.caseId) {
            <tr>
              <td>{{ c.caseId }}</td>
              <td>{{ c.status }}</td>
              <td>{{ c.assignee }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styleUrl: './pages.css',
})
export class CasesPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  cases: FraudCaseRow[] = new ConsoleScreenModels().fraudCases()
  source: 'api' | 'demo-fallback' = 'demo-fallback'

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    const items = await this.api.cases()
    if (!items) {
      this.source = 'demo-fallback'
      this.cases = new ConsoleScreenModels().fraudCases()
      return
    }
    this.source = 'api'
    this.cases = items.map((c) => ({
      caseId: c.caseId,
      status: c.status,
      assignee: c.assignee,
    }))
  }

  async open(): Promise<void> {
    await this.api.openCase(false)
    await this.reload()
  }
}
