namespace NightWatch.BuildingBlocks.Caching;

public enum IngestDedupOutcome
{
    AcceptedNew,
    Duplicate,
    CacheUnavailableUsePostgres
}

public sealed record IngestDedupResult(
    IngestDedupOutcome Outcome,
    string EventPublicId,
    string? PriorEventPublicId,
    CacheHealth CacheHealth);

/// <summary>
/// Coordinates cache idempotency with Postgres as source of truth.
/// Redis outage must NOT mean "treat every request as a brand-new identity".
/// </summary>
public sealed class IngestDeduper(IIdempotencyStore store)
{
    public static readonly TimeSpan DefaultIdempotencyTtl = TimeSpan.FromHours(24);

    public async Task<IngestDedupResult> RegisterAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        string candidateEventPublicId,
        Func<string, Task<string?>> findExistingInPostgresAsync,
        TimeSpan? ttl = null,
        CancellationToken ct = default)
    {
        var cache = await store.TryBeginAsync(
            tenantId,
            environmentId,
            idempotencyKey,
            candidateEventPublicId,
            ttl ?? DefaultIdempotencyTtl,
            ct);

        if (cache.Health == CacheHealth.Unavailable)
        {
            var pg = await findExistingInPostgresAsync(idempotencyKey);
            if (pg is not null)
            {
                return new IngestDedupResult(
                    IngestDedupOutcome.Duplicate,
                    pg,
                    pg,
                    CacheHealth.Unavailable);
            }

            // Persist path may continue, but identity matching must not assume "all new"
            // solely because Redis is down — caller uses Postgres visitor graph.
            return new IngestDedupResult(
                IngestDedupOutcome.CacheUnavailableUsePostgres,
                candidateEventPublicId,
                null,
                CacheHealth.Unavailable);
        }

        if (cache.IsDuplicate)
        {
            return new IngestDedupResult(
                IngestDedupOutcome.Duplicate,
                cache.ExistingEventPublicId ?? candidateEventPublicId,
                cache.ExistingEventPublicId,
                CacheHealth.Available);
        }

        return new IngestDedupResult(
            IngestDedupOutcome.AcceptedNew,
            candidateEventPublicId,
            null,
            CacheHealth.Available);
    }
}
