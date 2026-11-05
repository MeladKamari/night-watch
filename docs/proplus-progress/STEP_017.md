# STEP 017 — Ingest API with rate and payload controls

**Date:** 2026-11-04  
**Status:** `POST /v1/observations` **IMPLEMENTED**; WebApplicationFactory matrix **VALIDATED** (4/4).

## Deliverables

- `ObservationIngestService` — schema, origin allowlist, size, skew, nonce replay, rate limit, purpose/consent
- Client IP / risk / confidence / visitorId accepted in body but **never authoritative**
- Idempotency via `IngestDeduper` → 202 accepted / 200 duplicate
- `application/problem+json` errors; logs without raw fingerprint values
- `ObservationIngestTests` — accept, idempotency, origin/oversize/replay/applePay, fuzz CT/JSON

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~ObservationIngestTests
```

**Passed: 4**

## Limitations

- Ingest persists acceptance in-memory for this step; durable event write lands with later pipeline steps.
- Origin allowlist is config singleton (not yet DB-backed per tenant).

## Next

STEP 018 — Edge-aware IP and TLS signal adapter.
