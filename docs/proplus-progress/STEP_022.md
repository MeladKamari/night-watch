# STEP 022 — Event search and filtering API

**Date:** 2026-11-04  
**Status:** `GET /v1/events` search **IMPLEMENTED**; matrix **VALIDATED** (2/2). Network ASN licensed feed **UNAVAILABLE**.

## Deliverables

- Filters: eventId, visitorId, linkedId, from/to, suspect, riskBand, source, networkAsn, signalStatus
- Parameterized `EventSearchFilter`; sequence-ordered cursor; per-tenant/actor rate limit
- RBAC via `X-Api-Scope=events:search|events:*|*`; query audit log (no raw fingerprint)
- Planner hint when tenant approximate count ≥ threshold
- Cross-tenant isolation verified

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~EventSearchApiTests
```

**Passed: 2**

## Limitations

- In-memory catalog; ASN/`suspect`/`riskBand` default unknown/unavailable until intelligence feeds.
- API key kind/scope headers are stubs until full key verification step.

## Next

STEP 023 — (see step index).
