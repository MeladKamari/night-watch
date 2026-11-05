# STEP 004 — Bootstrap ASP.NET Core modular backend

**Date:** 2026-11-03  
**Status:** Backend scaffold **IMPLEMENTED**; `dotnet build/test` **VALIDATED** (4/4).

## Solution

`server/NightWatch.sln` (.NET **10.0.401**)

| Project | Role |
|---|---|
| `NightWatch.Api` | Host: health, meta, OTel, JSON logging |
| `NightWatch.BuildingBlocks` | Evidence statuses, product identity, module names |
| Modules: Ingestion, Identity, Intelligence, Risk, Admin, Webhooks, Privacy, Reporting | DI module markers |
| `NightWatch.Api.Tests` | xUnit WebApplicationFactory health tests |

Packages: Npgsql.EF Core, OpenTelemetry Hosting + AspNetCore instrumentation.

## Commands

```
cd server
dotnet restore NightWatch.sln
dotnet build NightWatch.sln -c Release
dotnet test NightWatch.sln -c Release
```

Results: **Build succeeded**, **Passed: 4**.

Offline restore: `server/docs/OFFLINE_RESTORE.md`.

## Endpoints

- `GET /health/live` — liveness, no secrets
- `GET /health/ready` — readiness (modules; postgres/redis marked unavailable until configured)
- `GET /v1/meta` — product + 8 modules; `runtimeVendorSaas: false`; `applePay: excluded`

## Limitations

- No real Postgres/Redis wiring yet (STEP 014/016).
- Modules are registration shells, not full domain logic.

## Next

STEP 005 — Environment configuration and feature flags.
