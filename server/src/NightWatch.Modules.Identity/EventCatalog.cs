using System.Collections.Concurrent;

namespace NightWatch.Modules.Identity;

public sealed record CatalogEventRecord
{
    public required string EventId { get; init; }
    public required string VisitorId { get; init; }
    public required string TenantId { get; init; }
    public required string ProjectId { get; init; }
    public required string Purpose { get; init; }
    public required string MatchType { get; init; }
    public required string EventStatus { get; init; } // created | enriched | evaluated | deleted
    public required string SignalStatus { get; init; } // known | unknown | unavailable | insufficient_evidence | pending
    public required string RiskStatus { get; init; } // unavailable | unknown | insufficient_evidence
    public required string ProcessingRevision { get; init; }
    public required string IdentityAlgorithmVersion { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? RetainUntil { get; init; }
    public DateTimeOffset? DeletedAt { get; init; }
    public string? EvidenceSummary { get; init; } // redacted profile only
    public string EnrichmentStatus { get; init; } = "pending";
    public string? LinkedId { get; init; }
    public string SuspectStatus { get; init; } = "unknown"; // unknown | unavailable | yes | no
    public string RiskBand { get; init; } = "unavailable"; // unavailable | low | medium | high
    public string Source { get; init; } = "browser_sdk";
    public string? NetworkAsn { get; init; } // null → unavailable (licensed feed)
    /// <summary>Monotonic insert sequence for stable cursor pagination.</summary>
    public long Sequence { get; init; }
}

public sealed record EventSearchFilter(
    string TenantId,
    string? EventId = null,
    string? VisitorId = null,
    string? LinkedId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    string? Suspect = null,
    string? RiskBand = null,
    string? Source = null,
    string? NetworkAsn = null,
    string? SignalStatus = null,
    long AfterSequence = 0,
    int Limit = 20);

public interface IIdentificationEventCatalog
{
    void Upsert(CatalogEventRecord record);
    CatalogEventRecord? GetByEventId(string eventId);
    IReadOnlyList<CatalogEventRecord> ListByVisitor(string visitorId, string tenantId);
    IReadOnlyList<CatalogEventRecord> Search(EventSearchFilter filter);
    int ApproximateTenantCount(string tenantId);
}

public sealed class InMemoryIdentificationEventCatalog : IIdentificationEventCatalog
{
    private readonly ConcurrentDictionary<string, CatalogEventRecord> _byEvent = new(StringComparer.Ordinal);
    private long _seq;

    public void Upsert(CatalogEventRecord record)
    {
        var withSeq = record.Sequence == 0
            ? record with { Sequence = Interlocked.Increment(ref _seq) }
            : record;
        _byEvent[withSeq.EventId] = withSeq;
    }

    public CatalogEventRecord? GetByEventId(string eventId) =>
        _byEvent.TryGetValue(eventId, out var r) ? r : null;

    public IReadOnlyList<CatalogEventRecord> ListByVisitor(string visitorId, string tenantId) =>
        _byEvent.Values
            .Where(e => e.VisitorId == visitorId && e.TenantId == tenantId)
            .OrderBy(e => e.Sequence)
            .ToList();

    public int ApproximateTenantCount(string tenantId) =>
        _byEvent.Values.Count(e => e.TenantId == tenantId);

    public IReadOnlyList<CatalogEventRecord> Search(EventSearchFilter filter)
    {
        IEnumerable<CatalogEventRecord> q = _byEvent.Values.Where(e => e.TenantId == filter.TenantId);

        if (!string.IsNullOrWhiteSpace(filter.EventId))
        {
            q = q.Where(e => e.EventId == filter.EventId);
        }

        if (!string.IsNullOrWhiteSpace(filter.VisitorId))
        {
            q = q.Where(e => e.VisitorId == filter.VisitorId);
        }

        if (!string.IsNullOrWhiteSpace(filter.LinkedId))
        {
            q = q.Where(e => e.LinkedId == filter.LinkedId);
        }

        if (filter.From is not null)
        {
            q = q.Where(e => e.CreatedAt >= filter.From);
        }

        if (filter.To is not null)
        {
            q = q.Where(e => e.CreatedAt <= filter.To);
        }

        if (!string.IsNullOrWhiteSpace(filter.Suspect))
        {
            q = q.Where(e => e.SuspectStatus == filter.Suspect);
        }

        if (!string.IsNullOrWhiteSpace(filter.RiskBand))
        {
            q = q.Where(e => e.RiskBand == filter.RiskBand);
        }

        if (!string.IsNullOrWhiteSpace(filter.Source))
        {
            q = q.Where(e => e.Source == filter.Source);
        }

        if (!string.IsNullOrWhiteSpace(filter.NetworkAsn))
        {
            q = q.Where(e => e.NetworkAsn == filter.NetworkAsn);
        }

        if (!string.IsNullOrWhiteSpace(filter.SignalStatus))
        {
            q = q.Where(e => e.SignalStatus == filter.SignalStatus);
        }

        return q
            .Where(e => e.DeletedAt is null)
            .Where(e => e.Sequence > filter.AfterSequence)
            .OrderBy(e => e.Sequence) // indexed sort key analogue
            .Take(Math.Clamp(filter.Limit, 1, 100))
            .ToList();
    }
}
