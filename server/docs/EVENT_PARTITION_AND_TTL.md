# Identification events — partition & TTL plan (STEP 015)

## ID planes (do not conflate)

| Field | Meaning |
|---|---|
| `visitors.public_id` (`v_…`) | Server-assigned opaque ID |
| `identification_events.legacy_browser_visitor_id` | Optional 32-hex from `@night-watch/browser-sdk` |
| `visitor_aliases` | Maps legacy hash / subject keys → server visitor |

## Partitioning (PostgreSQL production)

When event volume warrants (measure first):

```sql
-- Illustrative; apply via controlled migration later
-- PARTITION BY RANGE (created_at) with tenant_id in primary access index
-- CREATE TABLE identification_events (...) PARTITION BY RANGE (created_at);
```

Access indexes already modeled in EF:

- `(tenant_id, created_at)`
- `(tenant_id, visitor_id, created_at)`
- `(tenant_id, retain_until)`

## TTL / archival

1. On insert: `retain_until = created_at + tenant.default_retention_days` (UTC).
2. Nightly job: select `retain_until < now()`, archive to cold storage (optional), then hard-delete cascade of signals/evidence/failures/decisions for those event IDs.
3. Erasure requests (privacy) bypass TTL and delete immediately with audit.

SQLite lab tests use the same `RetainUntil` column without physical partitions.
