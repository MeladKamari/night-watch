# STEP 026 — API credential management

**Date:** 2026-11-04  
**Status:** Credential service **IMPLEMENTED**; public-key denial + immediate revoke **VALIDATED** (2/2).

## Deliverables

- `IApiCredentialService` — create/list/revoke/rotate; prefixes `pk_live_` / `sk_live_` / `sec_live_`
- Secret hashed at rest; plaintext revealed once on create/rotate
- Domain allowlist, scopes, per-key quota, trusted ingestion (non-public)
- Public keys denied for `visitors:history` / `events:*` / `risk:*` / `admin:*`
- Revocation immediate (TTL=0); admin audit entries

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~ApiCredentialTests
```

**Passed: 2**

## Limitations

- In-memory key store (Postgres `ScopedApiKey` wiring later).
- HTTP management routes not exposed yet (service/DI ready).

## Next

STEP 027 — (see step index).
