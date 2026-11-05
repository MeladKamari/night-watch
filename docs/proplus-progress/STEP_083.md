# STEP 083 — Threat intelligence and SIEM/SOAR integration

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (RiskTrack081_085Tests Passed 5).

## Changed files
- `server/src/NightWatch.Modules.Risk/Investigation/RiskOpsServices.cs`
- `server/tests/NightWatch.Api.Tests/RiskTrack081_085Tests.cs`
- `server/src/NightWatch.Modules.Risk/RiskModule.cs`

## Tests
```
dotnet test -c Release --filter FullyQualifiedName~RiskTrack081_085Tests
# Passed 5
```

## Next
STEP 084
