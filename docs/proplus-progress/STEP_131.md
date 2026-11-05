# STEP 131 — Admin durable state + remaining research wave close-out

**Date:** 2026-11-05

## Shipped
- `remote_access_detection` (21 web SmartSignals)
- Identify `sealedEnvelope` + `POST /v1/sealed/unseal`
- Decisions `scoreReceipt` on evaluate
- Console MFA opt-in (`NIGHT_WATCH_CONSOLE_MFA`) + OIDC metadata scaffold
- Helm chart `server/deploy/helm/night-watch`
- EF dual-write + boot hydrate: `management_api_keys`, `management_webhook_subscriptions`, `management_projects` (+ audit sink)
- Playwright console projects: chromium + firefox + webkit (offline)

## Verify
```bash
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~ConsoleAuthAndManagementTests
pnpm exec playwright test -c playwright.console.config.ts
```
