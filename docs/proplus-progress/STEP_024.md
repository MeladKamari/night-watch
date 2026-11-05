# STEP 024 — Visitor lifecycle and GDPR-style erasure equivalents

**Date:** 2026-11-04  
**Status:** DELETE visitor + privacy export **IMPLEMENTED**; erasure isolation **VALIDATED** (1/1).

## Deliverables

- `DELETE /v1/visitors/{id}` — soft-delete events, purge aliases, erasure registry, HMAC tombstone (non-reconstructive)
- Queued per-storage erasure jobs (`catalog`/`alias_index` done; `cache`/`graph` queued)
- `GET /v1/visitors/{id}/privacy-export` — admin redacted export with retention/backups policy
- Deleted visitor invisible to search; event GET → 410; legacy alias rematch creates new visitorId

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~VisitorLifecycleApiTests
```

**Passed: 1**

## Limitations

- In-memory erasure/tombstones; durable Postgres purge workers later.
- Cache/graph targets remain queued until dedicated stores exist.

## Next

STEP 025 — (see step index).
