using NightWatch.Persistence.Retention;

namespace NightWatch.Api.Tests;

public class RetentionMaintenanceTests
{
    [Fact]
    public void Dry_run_scopes_and_purge_removes_all_expected()
    {
        var svc = new RetentionMaintenanceService();
        var cutoff = DateTimeOffset.Parse("2026-10-01T00:00:00Z");
        svc.Seed(new RetentionRow { Store = "events", Id = "e1", TenantId = "ten_r", CreatedAt = cutoff.AddDays(-10) });
        svc.Seed(new RetentionRow { Store = "outbox", Id = "o1", TenantId = "ten_r", CreatedAt = cutoff.AddDays(-10) });
        svc.Seed(new RetentionRow { Store = "redis", Id = "r1", TenantId = "ten_r", CreatedAt = cutoff.AddDays(-10) });
        svc.Seed(new RetentionRow { Store = "analytics", Id = "a1", TenantId = "ten_r", CreatedAt = cutoff.AddDays(-10) });
        svc.Seed(new RetentionRow { Store = "search", Id = "s1", TenantId = "ten_r", CreatedAt = cutoff.AddDays(-10) });
        svc.Seed(new RetentionRow { Store = "events", Id = "e_keep", TenantId = "ten_r", CreatedAt = cutoff.AddDays(1) });

        var dry = svc.DryRun("ten_r", cutoff);
        Assert.Equal(5, dry.CandidateCount);
        Assert.Equal(new[] { "analytics", "events", "outbox", "redis", "search" }, dry.Stores);

        var purge = svc.Purge("ten_r", cutoff, TimeSpan.FromSeconds(1));
        Assert.True(purge.LockAcquired);
        Assert.Equal(5, purge.Purged);
        Assert.Equal(5, purge.ByStore.Values.Sum());

        var after = svc.DryRun("ten_r", cutoff);
        Assert.Equal(0, after.CandidateCount);
    }
}
