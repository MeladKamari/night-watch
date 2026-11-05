# STEP 025 — Secure webhooks outbound

**Date:** 2026-11-04  
**Status:** Outbound webhook pipeline **IMPLEMENTED**; signature/replay + SSRF matrix **VALIDATED** (2/2). Exactly-once delivery **NOT claimed** (`at_least_once_not_exactly_once`).

## Deliverables

- Subscriptions per tenant/environment with event filters (`event.identification|risk`, `visitor.merge|deleted`, `feedback.updated`)
- HMAC-SHA256 `v1=` signatures + timestamp; secret rotation keeps previous secret
- Queue/retry/exponential backoff, dead-letter + `ReplayDead`, circuit breaker
- SSRF-safe URL validation (private/metadata blocked; lab loopback HTTP allowed)
- Envelope schema `night-watch-webhook-v1`; `SampleWebhookConsumer` idempotent on `deliveryId`

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~WebhookOutboundTests
```

**Passed: 2**

## Limitations

- Transport injected (default no-op success); live HTTP client TLS pinning not wired.
- Asymmetric signing adapter not implemented (HMAC path only).
- No admin HTTP CRUD routes yet (service API + DI).

## Next

STEP 026 — (see step index).
