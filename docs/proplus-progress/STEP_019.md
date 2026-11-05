# STEP 019 — Event enrichment pipeline and durability

**Date:** 2026-11-04  
**Status:** Pipeline/outbox/inbox/DLQ **IMPLEMENTED**; unit matrix **VALIDATED** (3/3). Licensed async IP-intel provider **BLOCKED/UNVALIDATED** (default `Unavailable`).

## Deliverables

- `PipelineBusinessEvent` / `OutboxMessage` / `InboxReceipt` / `DeadLetterMessage` + EF mapping
- `EnrichmentPipeline.AcceptAsync` — sync baseline + transactional outbox row (`created`)
- `EnrichmentWorker` — claim/retry/backoff, inbox idempotency, DLQ after max attempts, `evaluate` follow-up
- Revision guard — stale outbox cannot overwrite newer enrichment
- Partial baseline → `insufficient_evidence` / `observe` (no false-negative “safe”)
- DI wiring in `AddIntelligenceModule`

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~EnrichmentPipelineTests
```

**Passed: 3**

## Limitations

- Default `UnavailableAsyncEnrichmentProvider` — no licensed enrichment datasets.
- SQLite lab path evaluates outbox schedule client-side (DateTimeOffset).
- Ingest API not yet calling `IEnrichmentPipeline` (wired in later identification API steps).
- No hosted background service loop yet (worker invoked explicitly / tests).

## Next

STEP 020 — Server identification API.
