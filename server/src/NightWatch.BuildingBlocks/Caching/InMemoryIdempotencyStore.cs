using System.Collections.Concurrent;

namespace NightWatch.BuildingBlocks.Caching;

/// <summary>Lab/dev store. Not for multi-instance production.</summary>
public sealed class InMemoryIdempotencyStore : IIdempotencyStore
{
    private readonly ConcurrentDictionary<string, (string EventId, DateTimeOffset Expires)> _idem = new();
    private readonly ConcurrentDictionary<string, (long Count, DateTimeOffset Expires)> _vel = new();

    public CacheHealth Health => CacheHealth.Available;

    public Task<IdempotencyLookup> TryBeginAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        string eventPublicId,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);
        ArgumentException.ThrowIfNullOrWhiteSpace(environmentId);
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(eventPublicId);

        var redisKey = RedisKeyNames.Idempotency(tenantId, environmentId, idempotencyKey);
        var now = DateTimeOffset.UtcNow;
        PurgeExpired(now);

        if (_idem.TryGetValue(redisKey, out var existing) && existing.Expires > now)
        {
            return Task.FromResult(new IdempotencyLookup(true, existing.EventId, CacheHealth.Available));
        }

        _idem[redisKey] = (eventPublicId, now.Add(ttl));
        return Task.FromResult(new IdempotencyLookup(false, null, CacheHealth.Available));
    }

    public Task<VelocityCount> IncrementVelocityAsync(
        string tenantId,
        string environmentId,
        string bucket,
        TimeSpan window,
        CancellationToken ct = default)
    {
        var redisKey = RedisKeyNames.Velocity(tenantId, environmentId, bucket);
        var now = DateTimeOffset.UtcNow;
        _vel.AddOrUpdate(
            redisKey,
            _ => (1, now.Add(window)),
            (_, prev) => prev.Expires <= now ? (1, now.Add(window)) : (prev.Count + 1, prev.Expires));
        var count = _vel[redisKey].Count;
        return Task.FromResult(new VelocityCount(count, CacheHealth.Available));
    }

    private void PurgeExpired(DateTimeOffset now)
    {
        foreach (var kv in _idem)
        {
            if (kv.Value.Expires <= now)
            {
                _idem.TryRemove(kv.Key, out _);
            }
        }
    }
}
