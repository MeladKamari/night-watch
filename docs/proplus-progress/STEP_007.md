# STEP 007 — Contracts and event versioning

**Date:** 2026-11-03  
**Status:** Schemas + validators **IMPLEMENTED**; Vitest **VALIDATED** (4).

## Artifacts

- `contracts/schemas/*.json` — Observation, IdentificationEvent, SignalEvaluation, RiskDecision, ServerReceipt, ErrorEnvelope, EvidenceCell
- `contracts/openapi/v1/openapi.yaml`
- `@thenightwatch/contracts` validators (`validateObservation`, etc.)
- Fixtures under `tests/fixtures/proplus/`
- `tests/proplus-step007-contracts.test.ts`

## Outcomes modeled

`new` / `matched` / `ambiguous` / `unsupported` (+ matchType including `unknown`). No universal uniqueness claim.

## Next

STEP 008 — Privacy and provenance design.
