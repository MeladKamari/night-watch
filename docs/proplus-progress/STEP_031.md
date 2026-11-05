# STEP 031 — Custom first-party gateway and offline hostnames

**Date:** 2026-11-04  
**Status:** Gateway configs **IMPLEMENTED**; offline artifact smoke **VALIDATED** (1/1). Live nginx/TLS process **NOT RUN** in CI (configs + PKI docs verified).

## Deliverables

- `deploy/gateway/nginx-first-party.conf`, `envoy-first-party.yaml`
- `hosts.offline.example`, `PRIVATE_PKI.md`
- `GatewayConfigValidator` — body limit, CSP, TLS, no foreign CDN, safe XFF

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~GatewayConfigTests
```

**Passed: 1**

## Next

STEP 032
