# STEP 020 — Server identification API

**Date:** 2026-11-04  
**Status:** `POST /v1/identify` **IMPLEMENTED**; WebApplicationFactory matrix **VALIDATED** (3/3). Calibrated confidence **UNAVAILABLE** (identity-v0). Licensed similarity matching **not used** (exact alias only).

## Deliverables

- `IIdentifyService` / `IdentifyService` — per-project namespace (`tenant:project:purpose`), exact legacy-hash alias match
- Response: opaque `visitorId`, `eventId`, `firstSeenAt`/`lastSeenAt`, `matched|created|ambiguous`, `confidence=null` + `confidenceStatus=unavailable`
- Short-lived HMAC receipt (`r1.{payload}.{sig}`); `enrichmentStatus=pending` until async pipeline completes
- No auto-merge of similar browsers (component-key similarity ignored)
- Idempotent within namespace; Apple Pay component rejected
- `IdentifyApiTests`

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~IdentifyApiTests
```

**Passed: 3**

## Limitations

- In-memory visitor/alias store (durable graph lands with later persistence wiring).
- Receipt signing key is lab default — must be rotated via secrets in production.
- Does not yet attach edge metadata or call enrichment pipeline on identify.

## Next

STEP 021 — (see step index).
