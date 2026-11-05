using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Identity;

public sealed class EventSearchOptions
{
    public int DefaultPageSize { get; set; } = 20;
    public int MaxPageSize { get; set; } = 100;
    public int RateLimitPerMinute { get; set; } = 60;
    public int LargeDatasetThreshold { get; set; } = 10_000;
}

public sealed record EventSearchHit(
    string EventId,
    string VisitorId,
    string? LinkedId,
    string SignalStatus,
    string SuspectStatus,
    string RiskBand,
    string Source,
    string NetworkAsnStatus,
    string? NetworkAsn,
    string CreatedAt,
    string Profile);

public sealed record EventSearchPage(
    IReadOnlyList<EventSearchHit> Items,
    string? NextCursor,
    bool HasMore,
    string PlannerHint,
    int Audited);

public interface IEventSearchService
{
    (int StatusCode, object Body) Search(
        string? tenantId,
        string? apiKeyKind,
        string? scope,
        string? eventId,
        string? visitorId,
        string? linkedId,
        string? from,
        string? to,
        string? suspect,
        string? riskBand,
        string? source,
        string? networkAsn,
        string? signalStatus,
        string? cursor,
        int? limit,
        string? actorId);
}

public sealed class EventSearchService(
    IIdentificationEventCatalog catalog,
    ILogger<EventSearchService> logger,
    EventSearchOptions? options = null) : IEventSearchService
{
    private readonly EventSearchOptions _options = options ?? new EventSearchOptions();
    private readonly ConcurrentDictionary<string, (int Count, DateTimeOffset Window)> _rate = new();
    private long _auditCount;

    public (int StatusCode, object Body) Search(
        string? tenantId,
        string? apiKeyKind,
        string? scope,
        string? eventId,
        string? visitorId,
        string? linkedId,
        string? from,
        string? to,
        string? suspect,
        string? riskBand,
        string? source,
        string? networkAsn,
        string? signalStatus,
        string? cursor,
        int? limit,
        string? actorId)
    {
        if (string.IsNullOrWhiteSpace(apiKeyKind)
            || (!string.Equals(apiKeyKind, "server", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(apiKeyKind, "secret", StringComparison.OrdinalIgnoreCase)))
        {
            return Problem(string.IsNullOrWhiteSpace(apiKeyKind) ? 401 : 403,
                string.IsNullOrWhiteSpace(apiKeyKind) ? "unauthorized" : "forbidden",
                "Server key with events:search scope required");
        }

        if (!string.Equals(scope, "events:search", StringComparison.Ordinal)
            && !string.Equals(scope, "events:*", StringComparison.Ordinal)
            && !string.Equals(scope, "*", StringComparison.Ordinal))
        {
            return Problem(403, "forbidden_scope", "RBAC scope events:search required");
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Problem(400, "tenant_required", "X-Tenant-Id required");
        }

        var rateKey = $"{tenantId}:{actorId ?? "anon"}";
        if (!TryRate(rateKey))
        {
            return Problem(429, "rate_limited", "Search rate limit exceeded");
        }

        DateTimeOffset? fromTs = null;
        DateTimeOffset? toTs = null;
        if (!string.IsNullOrWhiteSpace(from))
        {
            if (!DateTimeOffset.TryParse(from, out var f))
            {
                return Problem(400, "from_invalid", "from must be RFC3339");
            }

            fromTs = f;
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            if (!DateTimeOffset.TryParse(to, out var t))
            {
                return Problem(400, "to_invalid", "to must be RFC3339");
            }

            toTs = t;
        }

        var after = 0L;
        if (!string.IsNullOrWhiteSpace(cursor) && !TryDecodeCursor(cursor, out after))
        {
            return Problem(400, "cursor_invalid", "cursor invalid");
        }

        var pageSize = Math.Clamp(limit ?? _options.DefaultPageSize, 1, _options.MaxPageSize);
        var approx = catalog.ApproximateTenantCount(tenantId);
        var plannerHint = approx >= _options.LargeDatasetThreshold
            ? "prefer_narrow_filters_indexed_sequence"
            : "ok_full_scan_bounded";

        // Parameterized filter object (no string-concat query).
        var filter = new EventSearchFilter(
            TenantId: tenantId,
            EventId: EmptyToNull(eventId),
            VisitorId: EmptyToNull(visitorId),
            LinkedId: EmptyToNull(linkedId),
            From: fromTs,
            To: toTs,
            Suspect: EmptyToNull(suspect),
            RiskBand: EmptyToNull(riskBand),
            Source: EmptyToNull(source),
            NetworkAsn: EmptyToNull(networkAsn),
            SignalStatus: EmptyToNull(signalStatus),
            AfterSequence: after,
            Limit: pageSize + 1);

        var rows = catalog.Search(filter);
        var hasMore = rows.Count > pageSize;
        if (hasMore)
        {
            rows = rows.Take(pageSize).ToList();
        }

        string? next = hasMore && rows.Count > 0 ? EncodeCursor(rows[^1].Sequence) : null;
        var audited = (int)Interlocked.Increment(ref _auditCount);

        logger.LogInformation(
            "event_search_audit tenant={Tenant} actor={Actor} hits={Hits} planner={Planner} auditSeq={Audit}",
            tenantId,
            actorId ?? "anon",
            rows.Count,
            plannerHint,
            audited);

        var items = rows.Select(r => new EventSearchHit(
            r.EventId,
            r.VisitorId,
            r.LinkedId,
            r.SignalStatus,
            r.SuspectStatus,
            r.RiskBand,
            r.Source,
            r.NetworkAsn is null ? "unavailable" : "known",
            r.NetworkAsn,
            r.CreatedAt.ToString("O"),
            "redacted")).ToList();

        return (200, new EventSearchPage(items, next, hasMore, plannerHint, audited));
    }

    private bool TryRate(string key)
    {
        var now = DateTimeOffset.UtcNow;
        var entry = _rate.AddOrUpdate(
            key,
            _ => (1, now),
            (_, prev) => now - prev.Window > TimeSpan.FromMinutes(1) ? (1, now) : (prev.Count + 1, prev.Window));
        return entry.Count <= _options.RateLimitPerMinute;
    }

    private static string? EmptyToNull(string? v) => string.IsNullOrWhiteSpace(v) ? null : v;

    private static string EncodeCursor(long sequence) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"seq:{sequence}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool TryDecodeCursor(string cursor, out long sequence)
    {
        sequence = 0;
        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }

            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            return raw.StartsWith("seq:", StringComparison.Ordinal) && long.TryParse(raw[4..], out sequence);
        }
        catch
        {
            return false;
        }
    }

    private static (int, object) Problem(int status, string code, string detail) =>
        (status, new IdentifyProblem
        {
            Type = $"https://night-watch.local/problems/{code}",
            Title = code,
            Status = status,
            Code = code,
            Detail = detail
        });
}
