# STEP 074 — Fraud feedback training pipeline

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (FraudFeedbackTests Passed 2).

## Changed files
- `server/src/NightWatch.Modules.Risk/Feedback/FraudFeedbackPipeline.cs`
- `server/tests/NightWatch.Api.Tests/FraudFeedbackTests.cs`
- `server/src/NightWatch.Modules.Risk/RiskModule.cs`

## Implemented
- Labels: ConfirmedFraud / Legitimate / Unknown + adjudication
- Temporal holdout, leakage checks, ROC/AP/calibration on synthetic
- Model registry activate/rollback; raw PII rejected

## Tests
```
dotnet test --filter FullyQualifiedName~FraudFeedbackTests
# Passed 2
```

## Next
STEP 075
