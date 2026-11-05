# STEP 015 — Visitor, observation and event schema

**Date:** 2026-11-03  
**Status:** Schema **IMPLEMENTED**; seeded SQLite tests **VALIDATED** (4/4).

## Changed files

| Path | Role |
|---|---|
| `server/src/NightWatch.Persistence/Entities/IdentityEventEntities.cs` | visitors, aliases, linked_accounts, identity_edges, identification_events, signal_observations, evidence, collector_failures, event_decisions |
| `server/src/NightWatch.Persistence/ProPlusDbContext.cs` | DbSets + indexes + tenant filters |
| `server/src/NightWatch.Persistence/Retention/EventRetention.cs` | retain_until, history, expired count |
| `server/docs/EVENT_PARTITION_AND_TTL.md` | Postgres partition + TTL plan |
| `server/tests/NightWatch.Api.Tests/IdentityEventSchemaTests.cs` | seeded query / history / retention |

## Behavior

- Server `v_…` visitor ID and legacy 32-hex browser hash stored separately (`LegacyBrowserVisitorId` + `visitor_aliases`).
- Events append-only; `unknown` signal statuses and null risk scores preserved.
- Retention via `RetainUntil`; archival job counts expired rows (no silent conflation of IDs).

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~IdentityEventSchemaTests
```

**Passed: 4**

## Limitations

- Physical Postgres `PARTITION BY RANGE` not applied yet (documented plan only).
- Hard-delete archival worker not implemented (count/mark only).

## Next step

**STEP 016** — Redis cache, deduplication and counters.  
(Executing next as its own single step.)
