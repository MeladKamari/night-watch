# STEP 035 — Billing/quotas and metering for self-hosted installations

**Date:** 2026-11-04  
**Status:** Metering **IMPLEMENTED**; retry reconcile **VALIDATED** (1/1). No foreign payment gateway.

## Deliverables

- Per tenant/project/env monthly quotas; free-trial flag
- `quota_exceeded` without dropping already-accepted events
- Invoice CSV export (`paymentGateway=none_self_hosted`)

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~MeteringTests
```

**Passed: 1**

## Next

STEP 036
