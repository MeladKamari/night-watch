# STEP 016 — Redis cache, deduplication and counters

**Date:** 2026-11-03  
**Status:** Cache abstraction **IMPLEMENTED**; unit tests **VALIDATED** (3/3). Live Redis integration **NOT RUN** (compose Redis optional).

## Changed files

| Path | Role |
|---|---|
| `BuildingBlocks/Caching/IIdempotencyStore.cs` | Contract + health enum |
| `InMemoryIdempotencyStore.cs` | Dev/lab store |
| `RedisIdempotencyStore.cs` | StackExchange.Redis; outage → Unavailable |
| `UnavailableIdempotencyStore.cs` | Explicit fail store |
| `IngestDeduper.cs` | Dedup + Postgres fallback semantics |
| `RedisKeyNames.cs` | `ibfpp:t:{tenant}:e:{env}:…` |
| `CachingServiceCollectionExtensions.cs` | DI wiring |
| `Program.cs` | `AddProPlusCaching` |
| `RedisDedupeTests.cs` | Duplicate + outage tests |

## Behavior

- Namespaced keys per tenant/environment; TTL on idempotency and velocity.
- Duplicate idempotency → same `eventPublicId` (no double-count).
- Redis down → `CacheUnavailableUsePostgres` or Postgres duplicate; **not** silent `AcceptedNew` identity.

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~RedisDedupeTests
```

**Passed: 3**

## Limitations

- Connection pooling uses StackExchange defaults; no Testcontainers Redis in this step.
- Postgres idempotency table lookup is injected via callback (wired fully in ingest STEP 017).

## Next step

**STEP 017** — Ingest API with rate and payload controls.
