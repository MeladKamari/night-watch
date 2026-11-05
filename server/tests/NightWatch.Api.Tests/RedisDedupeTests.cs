using NightWatch.BuildingBlocks.Caching;

namespace NightWatch.Api.Tests;

public class RedisDedupeTests
{
    [Fact]
    public async Task Duplicate_requests_do_not_double_count_events()
    {
        var store = new InMemoryIdempotencyStore();
        var deduper = new IngestDeduper(store);
        var pgHits = 0;

        Task<string?> PgLookup(string key)
        {
            pgHits++;
            return Task.FromResult<string?>(null);
        }

        var first = await deduper.RegisterAsync("ten_a", "env_a", "idem-1", "ev_first", PgLookup);
        var second = await deduper.RegisterAsync("ten_a", "env_a", "idem-1", "ev_second", PgLookup);

        Assert.Equal(IngestDedupOutcome.AcceptedNew, first.Outcome);
        Assert.Equal(IngestDedupOutcome.Duplicate, second.Outcome);
        Assert.Equal("ev_first", second.EventPublicId);
        Assert.Equal(0, pgHits);

        var vel1 = await store.IncrementVelocityAsync("ten_a", "env_a", "ip:1.2.3.4", TimeSpan.FromMinutes(5));
        var vel2 = await store.IncrementVelocityAsync("ten_a", "env_a", "ip:1.2.3.4", TimeSpan.FromMinutes(5));
        Assert.Equal(1, vel1.Count);
        Assert.Equal(2, vel2.Count);
    }

    [Fact]
    public async Task Redis_outage_does_not_silently_mark_all_as_new_identity()
    {
        var store = new UnavailableIdempotencyStore();
        var deduper = new IngestDeduper(store);

        // Postgres already saw this idempotency key — must stay Duplicate.
        var dup = await deduper.RegisterAsync(
            "ten_a",
            "env_a",
            "idem-pg",
            "ev_new_candidate",
            _ => Task.FromResult<string?>("ev_existing_pg"));
        Assert.Equal(IngestDedupOutcome.Duplicate, dup.Outcome);
        Assert.Equal("ev_existing_pg", dup.EventPublicId);
        Assert.Equal(CacheHealth.Unavailable, dup.CacheHealth);

        // No Postgres hit yet — explicit degraded outcome, NOT "AcceptedNew" identity claim.
        var degraded = await deduper.RegisterAsync(
            "ten_a",
            "env_a",
            "idem-fresh",
            "ev_candidate",
            _ => Task.FromResult<string?>(null));
        Assert.Equal(IngestDedupOutcome.CacheUnavailableUsePostgres, degraded.Outcome);
        Assert.NotEqual(IngestDedupOutcome.AcceptedNew, degraded.Outcome);
        Assert.Equal(CacheHealth.Unavailable, degraded.CacheHealth);
    }

    [Fact]
    public void Keys_are_namespaced_per_tenant_and_environment()
    {
        var a = RedisKeyNames.Idempotency("t1", "e1", "k");
        var b = RedisKeyNames.Idempotency("t2", "e1", "k");
        Assert.StartsWith("ibfpp:t:t1:e:e1:idem:", a);
        Assert.NotEqual(a, b);
        Assert.Contains(":vel:", RedisKeyNames.Velocity("t1", "e1", "bucket"));
    }
}
