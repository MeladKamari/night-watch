# STEP 014 — PostgreSQL tenancy and core schema

**Date:** 2026-11-03  
**Status:** Schema + tenant filters **IMPLEMENTED**; SQLite in-memory round-trip **VALIDATED** (17 server tests). Postgres RLS SQL deferred to deploy hardening.

## Deliverables

- `NightWatch.Persistence` — tenants, projects, environments, origins, scoped_api_keys, audit_log
- Soft delete + `CurrentTenantId` query filters
- Indexes on `(tenant_id, …, created_at)`
- `TenancySchemaTests` — hierarchy, isolation, soft delete

## Commands

`dotnet test server/NightWatch.sln -c Release` → **Passed: 17**

## Limitations

- Formal EF migrations folder not yet generated against live Postgres (EnsureCreated used in tests); add `dotnet ef migrations add` when Postgres is up.
- SQLitePCL vulnerability advisory noted (test-only transitive).

## Next

STEP 015 — Visitor, observation and event schema.
