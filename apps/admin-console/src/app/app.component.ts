import { Component, inject } from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { NIGHT_WATCH_SESSION } from './core/auth.guard'
import { ConsoleApiService } from './core/api.service'
import { SessionStore } from './core/session.store'

@Component({
  selector: 'night-watch-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [attr.dir]="session.layout.dir" [attr.lang]="session.layout.locale">
      <header>
        <a class="brand" routerLink="/dashboard" aria-label="Night Watch">
          <img src="assets/logo-mark.png" width="36" height="36" alt="" />
          <strong>Night Watch</strong>
        </a>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/events" routerLinkActive="active">Events</a>
          <a routerLink="/visitors" routerLinkActive="active">Visitors</a>
          <a routerLink="/signals" routerLinkActive="active">Signals</a>
          <a routerLink="/rules" routerLinkActive="active">Rules</a>
          <a routerLink="/score" routerLinkActive="active">Score</a>
          <a routerLink="/bots" routerLinkActive="active">Bots</a>
          <a routerLink="/velocity" routerLinkActive="active">Velocity</a>
          <a routerLink="/cases" routerLinkActive="active">Cases</a>
          <a routerLink="/keys" routerLinkActive="active">Keys</a>
          <a routerLink="/settings" routerLinkActive="active">Tenant</a>
          <a routerLink="/audit" routerLinkActive="active">Audit</a>
          <a routerLink="/privacy" routerLinkActive="active">Privacy</a>
          <a routerLink="/docs/api" routerLinkActive="active">API</a>
          <a routerLink="/deploy" routerLinkActive="active">Deploy</a>
        </nav>
        <span class="user">{{ userLabel }}</span>
        @if (api.networkEnabled) {
          <button type="button" class="logout" (click)="logout()">Logout</button>
        }
      </header>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        font-family: Tahoma, 'Segoe UI', sans-serif;
        min-height: 100vh;
        background: linear-gradient(160deg, #070b14, #121a28 45%, #1a2740);
        color: #d7e0ea;
      }
      header {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1rem;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #2a3a52;
        background: color-mix(in srgb, #070b14 78%, transparent);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        color: #d7e0ea;
        text-decoration: none;
      }
      .brand img {
        border-radius: 6px;
        border: 1px solid #2a3a52;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem 0.75rem;
        flex: 1;
      }
      main {
        padding: 1.25rem;
      }
      a {
        color: #3ad7ff;
        text-decoration: none;
        font-size: 0.92rem;
      }
      a.active {
        font-weight: 700;
        text-decoration: underline;
      }
      .user {
        color: #8a97ab;
        font-size: 0.85rem;
      }
      .logout {
        font: inherit;
        border: 1px solid #2a3a52;
        background: #121a28;
        color: #d7e0ea;
        border-radius: 8px;
        padding: 0.3rem 0.6rem;
        cursor: pointer;
      }
    `,
  ],
})
export class AppComponent {
  readonly session = inject(NIGHT_WATCH_SESSION)
  readonly api = inject(ConsoleApiService)
  private readonly sessions = inject(SessionStore)
  private readonly router = inject(Router)

  get userLabel(): string {
    const s = this.sessions.session()
    return s ? `${s.username} (${s.role})` : this.api.networkEnabled ? 'signed out' : 'offline demo'
  }

  async logout(): Promise<void> {
    await this.api.logout()
    await this.router.navigateByUrl('/login')
  }
}
