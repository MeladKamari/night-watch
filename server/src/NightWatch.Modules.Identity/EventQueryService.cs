using System.Text;

namespace NightWatch.Modules.Identity;

public sealed class EventQueryOptions
{
    public int DefaultPageSize { get; set; } = 20;
    public int MaxPageSize { get; set; } = 100;
}

public sealed record EventView(
    string EventId,
    string VisitorId,
    string EventStatus,
    string SignalStatus,
    string RiskStatus,
    string MatchType,
    string ProcessingRevision,
    string IdentityAlgorithmVersion,
    string EnrichmentStatus,
    string CreatedAt,
    string? RetainUntil,
    string? EvidenceSummary,
    string Profile);

public sealed record EventHistoryPage(
    IReadOnlyList<EventView> Items,
    string? NextCursor,
    bool HasMore);

public interface IEventQueryService
{
    (int StatusCode, object Body) GetEvent(string eventId, string? tenantId, string? apiKeyKind);
    (int StatusCode, object Body) GetVisitorEvents(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? cursor,
        int? limit);
}

public sealed class EventQueryService(
    IIdentificationEventCatalog catalog,
    EventQueryOptions? options = null) : IEventQueryService
{
    private readonly EventQueryOptions _options = options ?? new EventQueryOptions();

    public (int StatusCode, object Body) GetEvent(string eventId, string? tenantId, string? apiKeyKind)
    {
        if (!AuthorizeServer(apiKeyKind, out var problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Problem(400, "tenant_required", "X-Tenant-Id required");
        }

        if (string.IsNullOrWhiteSpace(eventId) || !eventId.StartsWith("ev_", StringComparison.Ordinal))
        {
            return Problem(400, "event_id_invalid", "eventId format invalid");
        }

        var record = catalog.GetByEventId(eventId);
        if (record is null)
        {
            return Problem(404, "event_not_found", "Event not found");
        }

        if (!string.Equals(record.TenantId, tenantId, StringComparison.Ordinal))
        {
            // Tenant isolation: do not leak existence across tenants.
            return Problem(404, "event_not_found", "Event not found");
        }

        if (record.DeletedAt is not null)
        {
            return Problem(410, "event_deleted", "Event deleted under retention policy");
        }

        if (record.RetainUntil is not null && record.RetainUntil < DateTimeOffset.UtcNow)
        {
            return Problem(410, "event_expired", "Event past retention window");
        }

        return (200, ToView(record, redacted: true));
    }

    public (int StatusCode, object Body) GetVisitorEvents(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? cursor,
        int? limit)
    {
        if (!AuthorizeServer(apiKeyKind, out var problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Problem(400, "tenant_required", "X-Tenant-Id required");
        }

        if (string.IsNullOrWhiteSpace(visitorId) || !visitorId.StartsWith("v_", StringComparison.Ordinal))
        {
            return Problem(400, "visitor_id_invalid", "visitorId format invalid");
        }

        var pageSize = Math.Clamp(limit ?? _options.DefaultPageSize, 1, _options.MaxPageSize);
        var afterSeq = 0L;
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!TryDecodeCursor(cursor, out afterSeq))
            {
                return Problem(400, "cursor_invalid", "cursor is invalid");
            }
        }

        var all = catalog.ListByVisitor(visitorId, tenantId)
            .Where(e => e.DeletedAt is null)
            .Where(e => e.RetainUntil is null || e.RetainUntil >= DateTimeOffset.UtcNow)
            .Where(e => e.Sequence > afterSeq)
            .OrderBy(e => e.Sequence)
            .ToList();

        var page = all.Take(pageSize + 1).ToList();
        var hasMore = page.Count > pageSize;
        if (hasMore)
        {
            page = page.Take(pageSize).ToList();
        }

        string? next = null;
        if (hasMore && page.Count > 0)
        {
            next = EncodeCursor(page[^1].Sequence);
        }

        var items = page.Select(e => ToView(e, redacted: true)).ToList();
        return (200, new EventHistoryPage(items, next, hasMore));
    }

    private static bool AuthorizeServer(string? apiKeyKind, out (int, object) problem)
    {
        // Server-only: secret/server keys. Public/client keys denied.
        if (string.IsNullOrWhiteSpace(apiKeyKind))
        {
            problem = Problem(401, "unauthorized", "Server API key required");
            return false;
        }

        if (!string.Equals(apiKeyKind, "server", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(apiKeyKind, "secret", StringComparison.OrdinalIgnoreCase))
        {
            problem = Problem(403, "forbidden", "Client keys cannot read event history");
            return false;
        }

        problem = default;
        return true;
    }

    private static EventView ToView(CatalogEventRecord r, bool redacted) =>
        new(
            r.EventId,
            r.VisitorId,
            r.EventStatus,
            r.SignalStatus,
            r.RiskStatus,
            r.MatchType,
            r.ProcessingRevision,
            r.IdentityAlgorithmVersion,
            r.EnrichmentStatus,
            r.CreatedAt.ToString("O"),
            r.RetainUntil?.ToString("O"),
            redacted ? (r.EvidenceSummary ?? "redacted") : r.EvidenceSummary,
            redacted ? "redacted" : "full");

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
            if (!raw.StartsWith("seq:", StringComparison.Ordinal))
            {
                return false;
            }

            return long.TryParse(raw[4..], out sequence);
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
