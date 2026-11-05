namespace NightWatch.BuildingBlocks.Caching;

public enum CacheAvailability
{
    Available,
    Unavailable
}

public sealed record CacheResult<T>(CacheAvailability Availability, T? Value, string? Reason = null);

/// <summary>
/// Tenant-namespaced cache. Postgres remains system of record.
/// When unavailable, callers must degrade explicitly — never invent identity/risk.
/// </summary>
public interface IProPlusCache
{
    CacheAvailability Availability { get; }

    Task<CacheResult<bool>> TryAcquireIdempotencyAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        TimeSpan ttl,
        CancellationToken ct = default);

    Task<CacheResult<long>> IncrementVelocityAsync(
        string tenantId,
        string environmentId,
        string counterName,
        TimeSpan window,
        CancellationToken ct = default);
}
