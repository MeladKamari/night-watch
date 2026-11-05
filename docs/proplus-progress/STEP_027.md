# STEP 027 — Origin, request and network filtering

**Date:** 2026-11-04  
**Status:** Filter engine **IMPLEMENTED**; dry-run/spoof fixtures **VALIDATED** (1/1). Licensed ASN reputation **UNAVAILABLE** → safe default allow.

## Deliverables

- `NetworkFilterEngine` — rule AST (`AllOf` predicates), precedence, Edge vs RiskPolicy layers
- Dry-run flag; audit trail; legitimate automation allowlist
- Spoofed Origin / XFF ignored (only authoritative origin/IP matched)
- Stale/unavailable ASN → `allow_default_unavailable` (not edge deny)

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~NetworkFilterEngineTests
```

**Passed: 1**

## Limitations

- In-memory rules; admin CRUD HTTP not exposed.
- ASN matching only when `AsnStatus=known`.

## Next

STEP 028 — (see step index).
