import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'

@Component({
  standalone: true,
  template: `
    <section class="panel">
      <h1>{{ title }}</h1>
      <p class="lede">{{ blurb }}</p>
      <ul>
        @for (item of items; track item) {
          <li>{{ item }}</li>
        }
      </ul>
    </section>
  `,
  styleUrl: './pages.css',
})
export class DocsPage {
  title = 'Docs'
  blurb = ''
  items: string[] = []
  constructor(route: ActivatedRoute) {
    const kind = route.snapshot.data['kind'] as string
    if (kind === 'wrappers') {
      this.title = 'Browser framework wrappers'
      this.blurb = 'Angular / React / Vue / Next client-only loaders share @night-watch/web-agent.'
      this.items = ['SSR guard', 'No decision authority in frontend', 'Step-up UI consumes server action only']
    } else if (kind === 'deploy') {
      this.title = 'Enterprise first-party deployment'
      this.blurb = 'Iran / air-gapped on-prem pack — see server/deploy/ONPREM.md'
      this.items = [
        'docker-compose.yml: postgres + redis + api + worker',
        'NightWatch__IpDatasets__AllowOutboundLookup=false',
        'deploy/gateway first-party TLS termination',
        'compose.onprem.env.example + OFFLINE_IMAGES.md',
        'Helm: server/deploy/helm/night-watch (compose remains lab SoT)',
        'No foreign SaaS runtime dependency',
        'Identify sealedEnvelope + /v1/sealed/unseal',
      ]
    } else {
      this.title = 'Public API & SDKs'
      this.blurb = 'Contracts from @night-watch/contracts; management APIs require console session + CSRF.'
      this.items = [
        '/v1/identify',
        '/v1/observations',
        '/v1/decisions/evaluate',
        '/v1/management/graph',
        '/v1/management/score/explain',
        '/v1/management/privacy/*',
      ]
    }
  }
}
