using System.Collections.Concurrent;

namespace NightWatch.Modules.Risk.Behavior;

public enum BehaviorEventType
{
    LoginFailure,
    RegistrationRetry,
    StepUpFailure
}

public sealed record BehaviorEvent(
    string TenantId,
    string AccountHash,
    BehaviorEventType Type,
    DateTimeOffset At,
    string? SharedTerminalId);

public sealed record BehaviorAggregate(
    string Status, // known | unavailable | disabled
    int LoginFailures,
    int RegistrationRetries,
    int StepUpFailures,
    string? BurstNote);

/// <summary>
/// Optional first-party action counters. Disabled by default; no keystroke/pointer telemetry.
/// </summary>
public sealed class BehaviorVelocityModule
{
    private readonly ConcurrentDictionary<string, List<BehaviorEvent>> _events = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, int> _enumGuard = new(StringComparer.Ordinal);
    public bool Enabled { get; set; }

    public void Record(BehaviorEvent ev)
    {
        if (!Enabled) return;
        var guardKey = $"{ev.TenantId}|{ev.AccountHash}|{ev.At:yyyyMMddHH}";
        var count = _enumGuard.AddOrUpdate(guardKey, 1, (_, c) => c + 1);
        if (count > 30)
        {
            // anti-enumeration: drop excess probing
            return;
        }

        var list = _events.GetOrAdd($"{ev.TenantId}|{ev.AccountHash}", _ => []);
        lock (list)
        {
            list.Add(ev);
            if (list.Count > 500) list.RemoveRange(0, list.Count - 500);
        }
    }

    public BehaviorAggregate Aggregate(string tenantId, string accountHash, DateTimeOffset now, TimeSpan window)
    {
        if (!Enabled)
        {
            return new BehaviorAggregate("disabled", 0, 0, 0, null);
        }

        if (!_events.TryGetValue($"{tenantId}|{accountHash}", out var list))
        {
            return new BehaviorAggregate("unavailable", 0, 0, 0, null);
        }

        List<BehaviorEvent> snapshot;
        lock (list)
        {
            snapshot = list.Where(e => e.At >= now - window).ToList();
        }

        var login = snapshot.Count(e => e.Type == BehaviorEventType.LoginFailure);
        var reg = snapshot.Count(e => e.Type == BehaviorEventType.RegistrationRetry);
        var step = snapshot.Count(e => e.Type == BehaviorEventType.StepUpFailure);
        var shared = snapshot.Select(e => e.SharedTerminalId).Where(s => s is not null).Distinct().Count();
        string? burst = null;
        if (shared > 0 && login + reg > 20)
        {
            burst = "shared_terminal_burst_possible_legitimate";
        }

        return new BehaviorAggregate("known", login, reg, step, burst);
    }
}
