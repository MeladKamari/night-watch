# Incident runbook (privacy-safe)

1. Capture `correlation.id` from traces — never paste raw canvas/audio/visitor hashes into tickets.
2. Check `/health/ready`, metrics snapshot (`ingestFailures`, `webhookLagMsAvg`, `redisHitRatio`).
3. If dataset staleness rises: mark enrichment Unavailable; do not fabricate risk.
4. Webhook lag: inspect DLQ / circuit breaker; replay dead deliveries intentionally.
5. On suspected PII in logs: rotate log sink retention and sanitize with `LogSanitizer`.
