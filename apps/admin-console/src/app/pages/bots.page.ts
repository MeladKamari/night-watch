import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>پایش بات / Bot &amp; AI agent</h1>
      <p class="lede">UA alone never verifies. Source: <code>{{ source }}</code></p>
      <form class="grid" (ngSubmit)="verify()">
        <label>User-Agent <input [(ngModel)]="userAgent" name="ua" /></label>
        <button type="submit">Verify</button>
      </form>
      @if (result) {
        <p class="ok">{{ result.classification }} · {{ result.status }} · {{ result.evidence.join(', ') }}</p>
      }
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Evidence</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>VerifiedGoodBot</td>
            <td>signed identity</td>
            <td>UA alone never verifies</td>
          </tr>
          <tr>
            <td>SpoofedUserAgent</td>
            <td>bot-like UA, no signature</td>
            <td>investigation only</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styleUrl: './pages.css',
})
export class BotsPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  userAgent = 'Googlebot/2.1'
  result: { classification: string; status: string; evidence: string[] } | null = null

  async ngOnInit(): Promise<void> {
    await this.verify()
  }

  async verify(): Promise<void> {
    const r = await this.api.verifyBot(this.userAgent)
    if (!r) {
      this.source = 'demo-fallback'
      this.result = {
        classification: 'SpoofedUserAgent',
        status: 'known',
        evidence: ['ua_bot_like_without_signature (demo)'],
      }
      return
    }
    this.source = 'api'
    this.result = r
  }
}
