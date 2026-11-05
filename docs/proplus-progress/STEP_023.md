# STEP 023 — Event labels, tags and feedback

**Date:** 2026-11-04  
**Status:** PATCH annotations + POST feedback **IMPLEMENTED**; concurrent revision/audit **VALIDATED** (1/1).

## Deliverables

- `PATCH /v1/events/{eventId}` — tags, linkedId, heuristicSuspect with If-Match / `ifMatchRevision`
- `POST /v1/events/{eventId}/feedback` — adjudicated label (`legitimate|fraud|unknown`) + evidenceRef
- Heuristic suspect separated from adjudicated fraud label; original observation never overwritten
- Immutable audit trail (actor, reason, revision before/after, evidence ref)
- 409 on stale revision

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~EventAnnotationApiTests
```

**Passed: 1**

## Limitations

- Annotation store is in-memory (sidecar to identify catalog).
- GET annotation endpoint exists on service; HTTP route for GET annotation deferred if unused by clients.

## Next

STEP 024 — (see step index).
