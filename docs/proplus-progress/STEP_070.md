# STEP 070 — Smart Signal — Rare Device Detection

**Date:** 2026-11-04
**Status:** Evaluator **IMPLEMENTED/VALIDATED** via SmartSignalRegistry + SmartSignalTests (Passed 1).

## Changed files
- `server/src/NightWatch.Modules.Risk/SmartSignals/SmartSignalFramework.cs` — `RareDeviceDetectionEvaluator`
- `server/tests/NightWatch.Api.Tests/SmartSignalTests.cs` — registry count >= 19

## Notes
Honest `unknown`/`unavailable` when feeds or probes are missing. No foreign SaaS runtime dependency.

## Next
STEP 071
