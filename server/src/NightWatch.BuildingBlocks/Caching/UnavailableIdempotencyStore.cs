namespace NightWatch.BuildingBlocks.Caching;

/// <summary>Explicit outage stand-in used in tests and fail-closed wiring.</summary>
public sealed class UnavailableIdempotencyStore : IIdempotencyStore
{
    public CacheHealth Health => CacheHealth.Unavailable;

    public Task<IdempotencyLookup> TryBeginAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        string eventPublicId,
        TimeSpan ttl,
        CancellationToken ct = default) =>
        Task.FromResult(new IdempotencyLookup(false, null, CacheHealth.Unavailable));

    public Task<VelocityCount> IncrementVelocityAsync(
        string tenantId,
        string environmentId,
        string bucket,
        TimeSpan window,
        CancellationToken ct = default) =>
        Task.FromResult(new VelocityCount(0, CacheHealth.Unavailable));
}
