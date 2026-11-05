# STEP 073 — Suspect Score baseline and interpretable versioning

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (SuspectScoreTests Passed 3).

## Changed files
- `server/src/NightWatch.Modules.Risk/SuspectScore/SuspectScoreEngine.cs` (new)
- `server/src/NightWatch.Modules.Risk/RiskModule.cs` — DI
- `server/tests/NightWatch.Api.Tests/SuspectScoreTests.cs` (new)

## Implemented
- Transparent weighted 0–100 heuristic score (`heuristic_weighted`); never claims calibrated ML
- Per-tenant thresholds, version tags, enforce/shadow/calibration modes
- Contributions, unknown signals (0 points), reason codes; deterministic for same evidence/version
- Monotonic: more detections raise score

## Tests
```
dotnet test NightWatch.sln -c Release --filter "FullyQualifiedName~SuspectScoreTests"
# Passed! Failed: 0, Passed: 3
```

## Next
STEP 074 — Fraud feedback training pipeline
