using StackExchange.Redis;

namespace NightWatch.BuildingBlocks.Caching;

public sealed class RedisIdempotencyStore : IIdempotencyStore, IAsyncDisposable
{
    private readonly IConnectionMultiplexer _mux;
    private readonly bool _ownsMux;
    private CacheHealth _health = CacheHealth.Available;

    public RedisIdempotencyStore(IConnectionMultiplexer mux, bool ownsMux = false)
    {
        _mux = mux;
        _ownsMux = ownsMux;
    }

    public static async Task<RedisIdempotencyStore> ConnectAsync(string connectionString)
    {
        var mux = await ConnectionMultiplexer.ConnectAsync(connectionString);
        return new RedisIdempotencyStore(mux, ownsMux: true);
    }

    public CacheHealth Health => _health;

    public async Task<IdempotencyLookup> TryBeginAsync(
        string tenantId,
        string environmentId,
        string idempotencyKey,
        string eventPublicId,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        try
        {
            var db = _mux.GetDatabase();
            var key = RedisKeyNames.Idempotency(tenantId, environmentId, idempotencyKey);
            var set = await db.StringSetAsync(key, eventPublicId, ttl, When.NotExists);
            _health = CacheHealth.Available;
            if (!set)
            {
                var existing = await db.StringGetAsync(key);
                return new IdempotencyLookup(true, existing.HasValue ? existing.ToString() : null, CacheHealth.Available);
            }

            return new IdempotencyLookup(false, null, CacheHealth.Available);
        }
        catch
        {
            _health = CacheHealth.Unavailable;
            // Do not invent "new visitor" semantics — caller must fall back to Postgres idempotency.
            return new IdempotencyLookup(false, null, CacheHealth.Unavailable);
        }
    }

    public async Task<VelocityCount> IncrementVelocityAsync(
        string tenantId,
        string environmentId,
        string bucket,
        TimeSpan window,
        CancellationToken ct = default)
    {
        try
        {
            var db = _mux.GetDatabase();
            var key = RedisKeyNames.Velocity(tenantId, environmentId, bucket);
            var count = await db.StringIncrementAsync(key);
            if (count == 1)
            {
                await db.KeyExpireAsync(key, window);
            }

            _health = CacheHealth.Available;
            return new VelocityCount(count, CacheHealth.Available);
        }
        catch
        {
            _health = CacheHealth.Unavailable;
            return new VelocityCount(0, CacheHealth.Unavailable);
        }
    }

    public ValueTask DisposeAsync()
    {
        if (_ownsMux)
        {
            _mux.Dispose();
        }

        return ValueTask.CompletedTask;
    }
}
