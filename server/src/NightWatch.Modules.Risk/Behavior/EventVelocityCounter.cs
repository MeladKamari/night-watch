using System.Collections.Concurrent;

namespace NightWatch.Modules.Risk.Behavior;

/// <summary>In-process rolling hourly counters for velocity / high-activity signals.</summary>
public sealed class EventVelocityCounter
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<long>> _events = new(StringComparer.Ordinal);

    public int Record(string key, DateTimeOffset? at = null)
    {
        var ts = (at ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        var q = _events.GetOrAdd(key, _ => new ConcurrentQueue<long>());
        q.Enqueue(ts);
        return CountLastHour(q, ts);
    }

    public int GetLastHour(string key)
    {
        if (!_events.TryGetValue(key, out var q)) return 0;
        return CountLastHour(q, DateTimeOffset.UtcNow.ToUnixTimeSeconds());
    }

    private static int CountLastHour(ConcurrentQueue<long> q, long nowUnix)
    {
        var cutoff = nowUnix - 3600;
        while (q.TryPeek(out var oldest) && oldest < cutoff)
        {
            q.TryDequeue(out _);
        }

        return q.Count;
    }
}
