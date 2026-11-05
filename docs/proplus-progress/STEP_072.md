# STEP 072 — Unified signal registry, provenance and three-valued logic

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (UnifiedSignalRegistryTests Passed 4 + SmartSignalTests Passed 1).

## Changed files
- `server/src/NightWatch.Modules.Risk/SmartSignals/UnifiedSignalRegistry.cs` (new)
- `server/src/NightWatch.Modules.Risk/RiskModule.cs` — DI registration
- `server/tests/NightWatch.Api.Tests/UnifiedSignalRegistryTests.cs` (new)

## Implemented
- Catalog: 19 web/server evaluable + 10 native_deferred (never evaluated)
- Status vocabulary: detected / not_detected / unknown / unsupported / unavailable / not_applicable / error
- `DetectionTriState` three-valued logic; unknown never coerced to not_detected
- Provenance: source, input freshness, model version, platform availability, reason
- TTL cache with input-materialized keys + Invalidate(signalId|all)
- No circular evaluator dependencies (leaf functions over SmartSignalInput)

## Tests
```
dotnet test NightWatch.sln -c Release --filter "FullyQualifiedName~UnifiedSignalRegistryTests|FullyQualifiedName~SmartSignalTests"
# Passed! Failed: 0, Passed: 5
```

## Next
STEP 073 — Suspect Score baseline and interpretable versioning
