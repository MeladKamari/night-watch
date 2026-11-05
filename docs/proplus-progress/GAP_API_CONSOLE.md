# Gap closure — API wiring + browser matrix

**Date:** 2026-11-05

## API
- Console auth: login/logout/me (session + CSRF)
- Management: keys (list/create/revoke/rotate), cases, rules (get/simulate/publish/rollback), webhooks (list/create/rotate/deliveries/replay), projects (list/create/patch), audit, usage
- Public keys default scope `collect:ingest`
- `@night-watch/dashboard-client` covers the above
- `ConsoleAuthAndManagementTests` covers revoke + rules publish + webhooks + projects + audit

## Admin console
- Keys page: revoke + webhook create
- Rules page: publish + simulate
- Tenant page: create/patch projects
- Audit page: usage + signed audit list
- Playwright offline E2E: 3 passed (`playwright.console.config.ts`)
- Playwright live E2E: 2 passed (`playwright.console.live.config.ts` — login+CSRF create key, score/signals)
- Webhooks: enqueue + process pending + dead-letter replay UI
- Bots verify / Velocity enable-record / Signals catalog+evaluate wired

## Research backlog (implemented 2026-11-05)
- Graph: `GET/POST /v1/management/graph*` + Visitors page (decay projection)
- Score explain + facets: `POST /v1/management/score/explain` + Score page
- Signals: 21 web (`remote_access_detection` + automation agent) + sealed identify / decisions `scoreReceipt`
- Privacy DPO: `/v1/management/privacy/*` + Privacy page
- On-prem: `server/deploy/ONPREM.md` + Helm `server/deploy/helm/night-watch`
- Admin durable: EF dual-write/hydrate for keys, webhooks, projects, audit
- Console MFA opt-in (`NIGHT_WATCH_CONSOLE_MFA=1`) + OIDC metadata scaffold
- Details: `FEATURE_BACKLOG_FROM_RESEARCH.md`

## Enable live API in browser console
```js
window.NIGHT_WATCH_NETWORK = 1
window.NIGHT_WATCH_API_BASE = 'http://127.0.0.1:5080/'
window.NIGHT_WATCH_TENANT_ID = 'tenant_demo'
location.reload()
```
Lab credentials: `admin` / `admin-change-me`
