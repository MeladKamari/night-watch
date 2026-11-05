import 'zone.js'
import { bootstrapApplication } from '@angular/platform-browser'
import { provideRouter, Routes } from '@angular/router'
import { AppComponent } from './app/app.component'
import { NIGHT_WATCH_SESSION, guestGuard, roleGuard } from './app/core/auth.guard'
import { NIGHT_WATCH_API_CONFIG, type ConsoleApiConfig } from './app/core/api.service'
import type { Role } from './app/core/rbac'
import { layoutForLocale, type UiLocale } from './app/core/i18n-time'

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./app/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'events',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/events.page').then((m) => m.EventsPage),
  },
  {
    path: 'visitors',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/visitors.page').then((m) => m.VisitorsPage),
  },
  {
    path: 'signals',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/smart-signals.page').then((m) => m.SmartSignalsPage),
  },
  {
    path: 'rules',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/risk-rules.page').then((m) => m.RiskRulesPage),
  },
  {
    path: 'score',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/suspect-score.page').then((m) => m.SuspectScorePage),
  },
  {
    path: 'bots',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/bots.page').then((m) => m.BotsPage),
  },
  {
    path: 'velocity',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/velocity.page').then((m) => m.VelocityPage),
  },
  {
    path: 'cases',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/cases.page').then((m) => m.CasesPage),
  },
  {
    path: 'keys',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/api-keys.page').then((m) => m.ApiKeysPage),
  },
  {
    path: 'settings',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/tenant-config.page').then((m) => m.TenantConfigPage),
  },
  {
    path: 'audit',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/audit.page').then((m) => m.AuditPage),
  },
  {
    path: 'privacy',
    canActivate: [roleGuard],
    loadComponent: () => import('./app/pages/privacy.page').then((m) => m.PrivacyPage),
  },
  {
    path: 'docs/wrappers',
    canActivate: [roleGuard],
    data: { kind: 'wrappers' },
    loadComponent: () => import('./app/pages/docs.page').then((m) => m.DocsPage),
  },
  {
    path: 'docs/api',
    canActivate: [roleGuard],
    data: { kind: 'api' },
    loadComponent: () => import('./app/pages/docs.page').then((m) => m.DocsPage),
  },
  {
    path: 'deploy',
    canActivate: [roleGuard],
    data: { kind: 'deploy' },
    loadComponent: () => import('./app/pages/docs.page').then((m) => m.DocsPage),
  },
]

const apiConfig: ConsoleApiConfig = {
  baseUrl: (globalThis as { NIGHT_WATCH_API_BASE?: string }).NIGHT_WATCH_API_BASE ?? 'http://127.0.0.1:5080/',
  tenantId: (globalThis as { NIGHT_WATCH_TENANT_ID?: string }).NIGHT_WATCH_TENANT_ID ?? 'tenant_demo',
  networkEnabled:
    (globalThis as { NIGHT_WATCH_NETWORK?: string | number | boolean }).NIGHT_WATCH_NETWORK === 1 ||
    (globalThis as { NIGHT_WATCH_NETWORK?: string }).NIGHT_WATCH_NETWORK === '1' ||
    (globalThis as { NIGHT_WATCH_NETWORK?: boolean }).NIGHT_WATCH_NETWORK === true,
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    {
      provide: NIGHT_WATCH_SESSION,
      useValue: {
        roles: ['owner'] as Role[],
        locale: 'fa-IR' as UiLocale,
        layout: layoutForLocale('fa-IR'),
      },
    },
    { provide: NIGHT_WATCH_API_CONFIG, useValue: apiConfig },
  ],
}).catch((err) => console.error(err))
