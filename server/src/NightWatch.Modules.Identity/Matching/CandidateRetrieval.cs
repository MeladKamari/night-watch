using System.Collections.Concurrent;

namespace NightWatch.Modules.Identity.Matching;

public sealed class IndexedVisitor
{
    public required string TenantId { get; init; }
    public required string VisitorId { get; init; }
    public string? ContinuityId { get; init; }
    public string? BlockKey { get; init; } // e.g. os_family|browser_family|resolution_bucket
    public int? LshBucket { get; init; }
}

public sealed class CandidateQuery
{
    public required string TenantId { get; init; }
    public string? ContinuityId { get; init; }
    public string? BlockKey { get; init; }
    public int? LshBucket { get; init; }
    public int MaxCandidates { get; init; } = 50;
}

public sealed record CandidateResult(
    IReadOnlyList<string> VisitorIds,
    string Status, // exact | blocked | empty | stale_index
    string Detail);

public interface ICandidateRetrievalService
{
    void Upsert(IndexedVisitor visitor);
    CandidateResult Retrieve(CandidateQuery query);
}

public sealed class CandidateRetrievalService : ICandidateRetrievalService
{
    private readonly ConcurrentDictionary<string, IndexedVisitor> _byVisitor = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _continuity = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _blocks = new(StringComparer.Ordinal);
    private bool _stale;

    public void MarkStale() => _stale = true;
    public void ClearStale() => _stale = false;

    public void Upsert(IndexedVisitor visitor)
    {
        _byVisitor[visitor.VisitorId] = visitor;
        if (!string.IsNullOrWhiteSpace(visitor.ContinuityId))
        {
            var ck = $"{visitor.TenantId}|c|{visitor.ContinuityId}";
            _continuity.GetOrAdd(ck, _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal))[visitor.VisitorId] = 1;
        }

        if (!string.IsNullOrWhiteSpace(visitor.BlockKey))
        {
            var bk = $"{visitor.TenantId}|b|{visitor.BlockKey}";
            _blocks.GetOrAdd(bk, _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal))[visitor.VisitorId] = 1;
        }

        if (visitor.LshBucket is int lsh)
        {
            var lk = $"{visitor.TenantId}|l|{lsh}";
            _blocks.GetOrAdd(lk, _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal))[visitor.VisitorId] = 1;
        }
    }

    public CandidateResult Retrieve(CandidateQuery query)
    {
        if (_stale)
        {
            return new CandidateResult([], "stale_index", "index_marked_stale_fallback_empty");
        }

        // Reject user-controlled sort keys by never accepting order-by from query.
        var set = new HashSet<string>(StringComparer.Ordinal);

        if (!string.IsNullOrWhiteSpace(query.ContinuityId))
        {
            var ck = $"{query.TenantId}|c|{query.ContinuityId}";
            if (_continuity.TryGetValue(ck, out var exact))
            {
                foreach (var id in exact.Keys) set.Add(id);
                return Bound(set, query, "exact", "continuity_token");
            }
        }

        if (!string.IsNullOrWhiteSpace(query.BlockKey))
        {
            var bk = $"{query.TenantId}|b|{query.BlockKey}";
            if (_blocks.TryGetValue(bk, out var block))
            {
                foreach (var id in block.Keys) set.Add(id);
            }
        }

        if (query.LshBucket is int lsh)
        {
            var lk = $"{query.TenantId}|l|{lsh}";
            if (_blocks.TryGetValue(lk, out var lset))
            {
                foreach (var id in lset.Keys) set.Add(id);
            }
        }

        // Cross-tenant leak prevention: only keys prefixed with tenant.
        set.RemoveWhere(id => !_byVisitor.TryGetValue(id, out var v) || v.TenantId != query.TenantId);

        if (set.Count == 0)
        {
            return new CandidateResult([], "empty", "no_candidate_fallback_create_new");
        }

        return Bound(set, query, "blocked", "similarity_blocks");
    }

    private static CandidateResult Bound(HashSet<string> set, CandidateQuery query, string status, string detail)
    {
        var max = Math.Clamp(query.MaxCandidates, 1, 200);
        var list = set.OrderBy(x => x, StringComparer.Ordinal).Take(max).ToList();
        return new CandidateResult(list, status, detail);
    }
}
