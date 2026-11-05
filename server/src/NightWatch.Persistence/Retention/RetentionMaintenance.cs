using System.Collections.Concurrent;

namespace NightWatch.Persistence.Retention;

public sealed class RetentionRow
{
    public required string Store { get; init; } // events | outbox | redis | analytics | search
    public required string Id { get; init; }
    public required string TenantId { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public bool Purged { get; set; }
}

public sealed record RetentionDryRunResult(
    int CandidateCount,
    IReadOnlyList<string> Stores,
    IReadOnlyList<string> Ids);

public sealed record RetentionPurgeResult(
    int Purged,
    IReadOnlyDictionary<string, int> ByStore,
    bool LockAcquired);

public interface IRetentionMaintenanceService
{
    void Seed(RetentionRow row);
    RetentionDryRunResult DryRun(string tenantId, DateTimeOffset olderThan);
    RetentionPurgeResult Purge(string tenantId, DateTimeOffset olderThan, TimeSpan lockTimeout);
}

public sealed class RetentionMaintenanceService : IRetentionMaintenanceService
{
    private readonly ConcurrentDictionary<string, RetentionRow> _rows = new(StringComparer.Ordinal);
    private int _lock;

    public void Seed(RetentionRow row) => _rows[row.Id] = row;

    public RetentionDryRunResult DryRun(string tenantId, DateTimeOffset olderThan)
    {
        var candidates = _rows.Values
            .Where(r => r.TenantId == tenantId && !r.Purged && r.CreatedAt < olderThan)
            .ToList();
        return new RetentionDryRunResult(
            candidates.Count,
            candidates.Select(c => c.Store).Distinct().OrderBy(x => x).ToList(),
            candidates.Select(c => c.Id).OrderBy(x => x).ToList());
    }

    public RetentionPurgeResult Purge(string tenantId, DateTimeOffset olderThan, TimeSpan lockTimeout)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        while (Interlocked.CompareExchange(ref _lock, 1, 0) != 0)
        {
            if (sw.Elapsed > lockTimeout)
            {
                return new RetentionPurgeResult(0, new Dictionary<string, int>(), false);
            }

            Thread.Sleep(1);
        }

        try
        {
            var dry = DryRun(tenantId, olderThan);
            var byStore = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var id in dry.Ids)
            {
                if (_rows.TryGetValue(id, out var row))
                {
                    row.Purged = true;
                    byStore[row.Store] = byStore.GetValueOrDefault(row.Store) + 1;
                }
            }

            return new RetentionPurgeResult(dry.CandidateCount, byStore, true);
        }
        finally
        {
            Interlocked.Exchange(ref _lock, 0);
        }
    }
}
