# STEP 021 — Get event and event history API

**Date:** 2026-11-04  
**Status:** `GET /v1/events/{eventId}` and `GET /v1/visitors/{visitorId}/events` **IMPLEMENTED**; matrix **VALIDATED** (3/3 query + identify regression 3/3).

## Deliverables

- `IIdentificationEventCatalog` shared with identify writes
- `IEventQueryService` — server-only auth (`X-Api-Key-Kind=server|secret`), tenant filter, redacted profile
- Keyset/cursor pagination by monotonic sequence (stable under concurrent inserts)
- 404 cross-tenant / missing; 410 deleted or past `RetainUntil`
- Event/signal/risk/enrichment/processing revision fields on views

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter "FullyQualifiedName~EventQueryApiTests|FullyQualifiedName~IdentifyApiTests"
```

**Passed: 6**

## Limitations

- In-memory catalog (same lab store as identify).
- Auth is header kind stub until real scoped API-key verification step.
- Full evidence payloads remain redacted by design in this profile.

## Next

STEP 022 — (see step index).
