using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace NightWatch.Modules.Identity.Matching;

public enum AssignmentOutcome
{
    New,
    ExactMatch,
    ProbabilisticMatch,
    Ambiguous,
    Conflicting
}

public sealed class VisitorNode
{
    public required string VisitorId { get; init; }
    public required string TenantId { get; init; }
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public List<string> Aliases { get; } = [];
    public string? MergedInto { get; set; }
    public string? HighRecallId { get; set; }
}

public sealed class GraphEdge
{
    public required string EdgeId { get; init; }
    public required string TenantId { get; init; }
    public required string FromVisitorId { get; init; }
    public required string ToVisitorId { get; init; }
    public required string EdgeType { get; init; } // merge | split | link | share_hypothesis
    public required string EvidenceType { get; init; }
    public required string EvidenceStatus { get; init; } // known | unknown | insufficient_evidence
    public double? Confidence { get; init; }
    public required string Provenance { get; init; }
    public required string ModelVersion { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
    public DateTimeOffset? ReversedAt { get; set; }
    public string? Explanation { get; set; }
    public bool Active => ReversedAt is null;
}

public sealed class MergeDecisionRecord
{
    public required string DecisionId { get; init; }
    public required string TenantId { get; init; }
    public required string SurvivorId { get; init; }
    public required string AbsorbedId { get; init; }
    public required bool Automatic { get; init; }
    public required bool RolledBack { get; set; }
    public required string Reason { get; init; }
}

public sealed class AccountLink
{
    public required string LinkId { get; init; }
    public required string TenantId { get; init; }
    public required string VisitorId { get; init; }
    public required string AccountPseudonym { get; init; }
    public required DateTimeOffset LinkedAt { get; init; }
    public DateTimeOffset? UnlinkedAt { get; set; }
}

public interface IIdentityGraphService
{
    (AssignmentOutcome Outcome, VisitorNode Visitor) Assign(string tenantId, string? exactAlias, string matchDecision, double? score);
    bool TryAutoMerge(string tenantId, string a, string b, double precisionScore, out string? decisionId);
    bool ManualMerge(string tenantId, string survivor, string absorbed, string actor, out string? decisionId);
    bool RollbackMerge(string decisionId);
    string IssueHighRecallId(string tenantId, string cohortKey, bool enabledForPurpose);
    bool HighRiskMayUseHighRecallOnly(bool highRecallOnlyMatch);
    void TouchSeen(string tenantId, string visitorId, DateTimeOffset at);
    (DateTimeOffset First, DateTimeOffset Last)? GetSeen(string tenantId, string visitorId);
    AccountLink LinkAccount(string tenantId, string visitorId, string rawAccountId, string tenantHmacKey);
    IReadOnlyList<AccountLink> LinksForVisitor(string tenantId, string visitorId, int max = 50);
    void DeleteVisitorCascade(string tenantId, string visitorId);
    GraphEdge AddEdge(GraphEdge edge);
    bool ReverseEdge(string edgeId, string explanation);
    bool WouldCreateCycle(string tenantId, string from, string to);
    IReadOnlyList<GraphEdge> ActiveEdges(string tenantId);
    /// <summary>Active edges with temporal confidence decay (half-life days) and ExpiresAt filter.</summary>
    IReadOnlyList<ProjectedGraphEdge> ProjectActiveEdges(string tenantId, DateTimeOffset? now = null, double halfLifeDays = 180);
}

public sealed record ProjectedGraphEdge(
    GraphEdge Edge,
    double EffectiveConfidence,
    bool Expired,
    string DecayNote);

public sealed class IdentityGraphService : IIdentityGraphService
{
    private readonly ConcurrentDictionary<string, VisitorNode> _visitors = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, string> _aliasIndex = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, MergeDecisionRecord> _merges = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, GraphEdge> _edges = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, AccountLink> _links = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, string> _highRecall = new(StringComparer.Ordinal);

    private static string VKey(string tenantId, string visitorId) => $"{tenantId}:{visitorId}";
    private static string AKey(string tenantId, string alias) => $"{tenantId}|a|{alias}";

    public (AssignmentOutcome Outcome, VisitorNode Visitor) Assign(string tenantId, string? exactAlias, string matchDecision, double? score)
    {
        if (!string.IsNullOrWhiteSpace(exactAlias) && _aliasIndex.TryGetValue(AKey(tenantId, exactAlias), out var existingId))
        {
            var node = _visitors[VKey(tenantId, existingId)];
            if (node.MergedInto is not null)
            {
                node = _visitors[VKey(tenantId, node.MergedInto)];
            }

            TouchSeen(tenantId, node.VisitorId, DateTimeOffset.UtcNow);
            return (AssignmentOutcome.ExactMatch, node);
        }

        var outcome = matchDecision switch
        {
            "match" when score >= 0.9 => AssignmentOutcome.ProbabilisticMatch,
            "ambiguous" => AssignmentOutcome.Ambiguous,
            "conflicting" => AssignmentOutcome.Conflicting,
            _ => AssignmentOutcome.New
        };

        // Probabilistic match without exact alias still creates NEW id (no silent false merge).
        if (outcome is AssignmentOutcome.ProbabilisticMatch or AssignmentOutcome.Ambiguous or AssignmentOutcome.Conflicting
            || outcome == AssignmentOutcome.New)
        {
            var now = DateTimeOffset.UtcNow;
            var id = "v_" + Guid.NewGuid().ToString("N")[..16];
            var visitor = new VisitorNode { VisitorId = id, TenantId = tenantId, FirstSeenAt = now, LastSeenAt = now };
            if (!string.IsNullOrWhiteSpace(exactAlias))
            {
                visitor.Aliases.Add(exactAlias);
                _aliasIndex[AKey(tenantId, exactAlias)] = id;
            }

            _visitors[VKey(tenantId, id)] = visitor;
            return (outcome == AssignmentOutcome.ProbabilisticMatch ? AssignmentOutcome.New : outcome, visitor);
        }

        throw new InvalidOperationException("unreachable");
    }

    public bool TryAutoMerge(string tenantId, string a, string b, double precisionScore, out string? decisionId)
    {
        decisionId = null;
        // High precision only for automatic merge.
        if (precisionScore < 0.98)
        {
            return false;
        }

        return ManualMerge(tenantId, a, b, "system_auto", out decisionId);
    }

    public bool ManualMerge(string tenantId, string survivor, string absorbed, string actor, out string? decisionId)
    {
        decisionId = null;
        if (!_visitors.ContainsKey(VKey(tenantId, survivor)) || !_visitors.ContainsKey(VKey(tenantId, absorbed)))
        {
            return false;
        }

        if (WouldCreateCycle(tenantId, absorbed, survivor))
        {
            return false;
        }

        var abs = _visitors[VKey(tenantId, absorbed)];
        abs.MergedInto = survivor;
        foreach (var alias in abs.Aliases)
        {
            _aliasIndex[AKey(tenantId, alias)] = survivor;
            _visitors[VKey(tenantId, survivor)].Aliases.Add(alias);
        }

        decisionId = "md_" + Guid.NewGuid().ToString("N")[..10];
        _merges[decisionId] = new MergeDecisionRecord
        {
            DecisionId = decisionId,
            TenantId = tenantId,
            SurvivorId = survivor,
            AbsorbedId = absorbed,
            Automatic = actor == "system_auto",
            RolledBack = false,
            Reason = actor
        };

        AddEdge(new GraphEdge
        {
            EdgeId = "ge_" + decisionId,
            TenantId = tenantId,
            FromVisitorId = absorbed,
            ToVisitorId = survivor,
            EdgeType = "merge",
            EvidenceType = "assignment_policy",
            EvidenceStatus = "known",
            Confidence = actor == "system_auto" ? 0.99 : null,
            Provenance = actor,
            ModelVersion = "night-watch-identity-graph-v1",
            CreatedAt = DateTimeOffset.UtcNow,
            Explanation = $"merge {absorbed} -> {survivor}"
        });
        return true;
    }

    public bool RollbackMerge(string decisionId)
    {
        if (!_merges.TryGetValue(decisionId, out var md) || md.RolledBack)
        {
            return false;
        }

        md.RolledBack = true;
        var abs = _visitors[VKey(md.TenantId, md.AbsorbedId)];
        abs.MergedInto = null;
        foreach (var alias in abs.Aliases.ToList())
        {
            _aliasIndex[AKey(md.TenantId, alias)] = md.AbsorbedId;
            _visitors[VKey(md.TenantId, md.SurvivorId)].Aliases.Remove(alias);
        }

        if (_edges.TryGetValue("ge_" + decisionId, out var edge))
        {
            edge.ReversedAt = DateTimeOffset.UtcNow;
            edge.Explanation = (edge.Explanation ?? "") + "|rollback";
        }

        return true;
    }

    public string IssueHighRecallId(string tenantId, string cohortKey, bool enabledForPurpose)
    {
        if (!enabledForPurpose)
        {
            return "hr_disabled";
        }

        var key = $"{tenantId}|hr|{cohortKey}";
        return _highRecall.GetOrAdd(key, _ => "hr_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant()[..12]);
    }

    public bool HighRiskMayUseHighRecallOnly(bool highRecallOnlyMatch) => !highRecallOnlyMatch;

    public void TouchSeen(string tenantId, string visitorId, DateTimeOffset at)
    {
        if (_visitors.TryGetValue(VKey(tenantId, visitorId), out var v))
        {
            if (at < v.FirstSeenAt) v.FirstSeenAt = at;
            if (at > v.LastSeenAt) v.LastSeenAt = at;
        }
    }

    public (DateTimeOffset First, DateTimeOffset Last)? GetSeen(string tenantId, string visitorId) =>
        _visitors.TryGetValue(VKey(tenantId, visitorId), out var v) ? (v.FirstSeenAt, v.LastSeenAt) : null;

    public AccountLink LinkAccount(string tenantId, string visitorId, string rawAccountId, string tenantHmacKey)
    {
        var pseudo = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(tenantHmacKey), Encoding.UTF8.GetBytes($"{tenantId}|{rawAccountId}"))).ToLowerInvariant()[..24];
        var link = new AccountLink
        {
            LinkId = "lnk_" + Guid.NewGuid().ToString("N")[..10],
            TenantId = tenantId,
            VisitorId = visitorId,
            AccountPseudonym = "ap_" + pseudo,
            LinkedAt = DateTimeOffset.UtcNow
        };
        _links[link.LinkId] = link;
        return link;
    }

    public IReadOnlyList<AccountLink> LinksForVisitor(string tenantId, string visitorId, int max = 50) =>
        _links.Values.Where(l => l.TenantId == tenantId && l.VisitorId == visitorId && l.UnlinkedAt is null)
            .Take(Math.Clamp(max, 1, 100))
            .ToList();

    public void DeleteVisitorCascade(string tenantId, string visitorId)
    {
        foreach (var link in _links.Values.Where(l => l.TenantId == tenantId && l.VisitorId == visitorId))
        {
            link.UnlinkedAt = DateTimeOffset.UtcNow;
        }

        foreach (var edge in _edges.Values.Where(e => e.TenantId == tenantId && (e.FromVisitorId == visitorId || e.ToVisitorId == visitorId) && e.Active))
        {
            edge.ReversedAt = DateTimeOffset.UtcNow;
        }

        _visitors.TryRemove(VKey(tenantId, visitorId), out _);
    }

    public GraphEdge AddEdge(GraphEdge edge)
    {
        _edges[edge.EdgeId] = edge;
        return edge;
    }

    public bool ReverseEdge(string edgeId, string explanation)
    {
        if (!_edges.TryGetValue(edgeId, out var e) || !e.Active)
        {
            return false;
        }

        e.ReversedAt = DateTimeOffset.UtcNow;
        e.Explanation = (e.Explanation ?? "") + "|" + explanation;
        return true;
    }

    public bool WouldCreateCycle(string tenantId, string from, string to)
    {
        // Follow MergedInto / active merge edges from `to` — if we reach `from`, cycle.
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var cur = to;
        while (!string.IsNullOrWhiteSpace(cur) && seen.Add(cur))
        {
            if (cur == from) return true;
            if (_visitors.TryGetValue(VKey(tenantId, cur), out var n) && n.MergedInto is not null)
            {
                cur = n.MergedInto;
                continue;
            }

            break;
        }

        return false;
    }

    public IReadOnlyList<GraphEdge> ActiveEdges(string tenantId) =>
        _edges.Values.Where(e => e.TenantId == tenantId && e.Active).ToList();

    public IReadOnlyList<ProjectedGraphEdge> ProjectActiveEdges(string tenantId, DateTimeOffset? now = null, double halfLifeDays = 180)
    {
        var at = now ?? DateTimeOffset.UtcNow;
        var hl = Math.Max(1.0, halfLifeDays);
        return ActiveEdges(tenantId).Select(e =>
        {
            var expired = e.ExpiresAt is not null && e.ExpiresAt <= at;
            var baseConf = e.Confidence ?? 0.5;
            var ageDays = Math.Max(0, (at - e.CreatedAt).TotalDays);
            var decayed = expired ? 0 : baseConf * Math.Exp(-ageDays / hl);
            var note = expired
                ? "expired"
                : $"decay=exp(-{ageDays:F1}/{hl:F0}) base={baseConf:F2}";
            return new ProjectedGraphEdge(e, Math.Clamp(decayed, 0, 1), expired, note);
        }).Where(p => !p.Expired).OrderByDescending(p => p.EffectiveConfidence).ToList();
    }
}
