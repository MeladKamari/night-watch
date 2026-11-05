using NightWatch.Modules.Identity.Matching;

namespace NightWatch.Api.Tests;

public class IdentityGraphTests
{
    [Fact]
    public void Merge_collision_rollback_and_high_recall_ignored_for_high_risk()
    {
        var g = new IdentityGraphService();
        var (_, a) = g.Assign("ten", "alias_a", "new", null);
        var (_, b) = g.Assign("ten", "alias_b", "new", null);

        Assert.False(g.TryAutoMerge("ten", a.VisitorId, b.VisitorId, 0.5, out _));
        Assert.True(g.ManualMerge("ten", a.VisitorId, b.VisitorId, "reviewer", out var decisionId));
        Assert.True(g.RollbackMerge(decisionId!));

        var edge = g.ActiveEdges("ten");
        Assert.Empty(edge); // merge edge reversed

        var hr = g.IssueHighRecallId("ten", "cohort1", enabledForPurpose: true);
        Assert.StartsWith("hr_", hr);
        Assert.False(g.HighRiskMayUseHighRecallOnly(highRecallOnlyMatch: true));
        Assert.True(g.HighRiskMayUseHighRecallOnly(highRecallOnlyMatch: false));
    }

    [Fact]
    public void Seen_window_account_links_bounded_no_cross_tenant_cascade()
    {
        var g = new IdentityGraphService();
        var (_, v) = g.Assign("ten", "x", "new", null);
        var t0 = DateTimeOffset.UtcNow.AddDays(-10);
        var t1 = DateTimeOffset.UtcNow.AddDays(10);
        g.TouchSeen("ten", v.VisitorId, t0);
        g.TouchSeen("ten", v.VisitorId, t1);
        var seen = g.GetSeen("ten", v.VisitorId)!.Value;
        Assert.Equal(t0, seen.First);
        Assert.Equal(t1, seen.Last);

        g.LinkAccount("ten", v.VisitorId, "acct-1", "hmac");
        g.LinkAccount("ten", v.VisitorId, "acct-2", "hmac");
        Assert.Equal(2, g.LinksForVisitor("ten", v.VisitorId).Count);
        Assert.Empty(g.LinksForVisitor("other", v.VisitorId));

        g.DeleteVisitorCascade("ten", v.VisitorId);
        Assert.Empty(g.LinksForVisitor("ten", v.VisitorId));
        Assert.Null(g.GetSeen("ten", v.VisitorId));
    }

    [Fact]
    public void Graph_edge_explanation_reversible_without_losing_visitors()
    {
        var g = new IdentityGraphService();
        var (_, a) = g.Assign("ten", null, "new", null);
        var (_, b) = g.Assign("ten", null, "new", null);
        var e = g.AddEdge(new GraphEdge
        {
            EdgeId = "ge_test1",
            TenantId = "ten",
            FromVisitorId = a.VisitorId,
            ToVisitorId = b.VisitorId,
            EdgeType = "share_hypothesis",
            EvidenceType = "cohort",
            EvidenceStatus = "insufficient_evidence",
            Confidence = null,
            Provenance = "analyst",
            ModelVersion = "night-watch-identity-graph-v1",
            CreatedAt = DateTimeOffset.UtcNow,
            Explanation = "same_office_wifi_hypothesis"
        });
        Assert.Contains("hypothesis", e.Explanation);
        Assert.True(g.ReverseEdge("ge_test1", "false_positive"));
        Assert.NotNull(g.GetSeen("ten", a.VisitorId));
        Assert.NotNull(g.GetSeen("ten", b.VisitorId));
        Assert.Empty(g.ActiveEdges("ten"));
    }
}
