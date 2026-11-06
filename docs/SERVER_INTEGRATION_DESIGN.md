# First-party optional server integration — design only (step 71)

**No server or network collector is implemented in `@thenightwatch/browser-sdk`.**
The browser package remains fully functional offline. This document + the
`FIRST_PARTY_SERVER_INTEGRATION_DESIGN` constant capture a future opt-in API.

## Goals

- Consented fingerprint **evidence** delivery to a **first-party** endpoint.
- Authentication, retention, user deletion, rate limits, encryption — deployer-owned.
- No hardcoded third-party cloud (Fingerprint SaaS, CDN analytics, etc.).

## Design snapshot

See `FIRST_PARTY_SERVER_INTEGRATION_DESIGN` / revision `night-watch-server-design-v1`:

| Concern | Design |
|---|---|
| Auth | First-party bearer / mTLS / signed request; rotate ≤ 90 days |
| Retention | Deployer max-age; delete-on-request required |
| Rate limit | Per-IP and per-subject budgets |
| Encryption | TLS 1.2+ in transit; at-rest deployer-managed |
| Evidence schema | `night-watch-evidence-v1` (minimized components; no page URLs/cookies) |
| Deletion | `DELETE /v1/subjects/{subjectKey}` + purge receipt |

## Iran / regional hosting

Optional local ingestion must be first-party only. The deployer chooses regional
or on-prem hosting and privacy retention — the SDK ships **no** cloud endpoint.

## Non-goals (this step)

- No `fetch` client, WebSocket, or beacon in the browser SDK.
- No change to `load()` / visitorId algorithms.
- A separately versioned server package would require a future ADR.
