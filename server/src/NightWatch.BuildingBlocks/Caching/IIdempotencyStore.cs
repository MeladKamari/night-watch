namespace NightWatch.BuildingBlocks.Caching;

public enum CacheHealth
{
    Available,
    Unavailable,
    Degraded
}

public sealed record IdempotencyLookup(
    bool IsDuplicate,
    string? ExistingEventPublicId,
    CacheHealth Health);

public sealed record VelocityCount(
    long Count,
    CacheHealth Health);

/// <summary>
/// Ephemeral cache primitives. Postgres remains system of record.
/// </summary>
public interface IIdempotencyStore
{
    CacheHealth Health { get; }

    Task<IdempotencyLookup> TryBeginAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        string eventPublicId,
        TimeSpan ttl,
        CancellationToken ct = default);

    Task<VelocityCount> IncrementVelocityAsync(
        string tenantId,
        string environmentId,
        string bucket,
        TimeSpan window,
        CancellationToken ct = default);
}
