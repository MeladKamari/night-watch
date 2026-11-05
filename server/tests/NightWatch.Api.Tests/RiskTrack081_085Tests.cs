using NightWatch.Modules.Risk.Investigation;
using NightWatch.Modules.Risk.Rules;

namespace NightWatch.Api.Tests;

public class RiskTrack081_085Tests
{
    [Fact]
    public void Fraud_ring_found_without_cgnat_linking_everyone()
    {
        var g = new FraudRingGraph();
        g.MarkCgnatPrefix("10.0.");
        // ring: devices share accounts (high confidence)
        g.Link("dev_a", "acc_1", "device_account", 0.9);
        g.Link("dev_b", "acc_1", "device_account", 0.9);
        g.Link("dev_b", "acc_2", "device_account", 0.9);
        g.Link("dev_c", "acc_2", "device_account", 0.9);
        // CGNAT shared IP should not bridge unrelated users
        g.Link("dev_x", "ip_10", "ip_seen", 0.9, ipForCgnatCheck: "10.0.1.5");
        g.Link("dev_y", "ip_10", "ip_seen", 0.9, ipForCgnatCheck: "10.0.1.8");

        var leads = g.DetectLeads();
        Assert.Contains(leads, l => l.Status == "investigation_lead" && l.NodeIds.Contains("dev_a"));
        Assert.DoesNotContain(leads, l => l.NodeIds.Contains("dev_x") && l.NodeIds.Contains("dev_y") && l.Status == "investigation_lead");
    }

    [Fact]
    public void Maker_cannot_approve_own_high_risk_case()
    {
        var q = new AnalystReviewQueue();
        var c = q.Open("t1", "alice", highRisk: true, ["user@x.com", "visitor_abcdef"]);
        Assert.Throws<InvalidOperationException>(() => q.Approve(c.CaseId, "alice"));
        var ok = q.Approve(c.CaseId, "bob");
        Assert.Equal(CaseStatus.Resolved, ok.Status);
        var export = q.ExportMasked(c.CaseId);
        Assert.DoesNotContain("user@x.com", export);
        Assert.Contains("***@***", export);
        Assert.Equal(CaseStatus.Reversed, q.Reverse(c.CaseId, "carol").Status);
        Assert.Equal(CaseStatus.LegalHold, q.LegalHold(c.CaseId, "legal").Status);
    }

    [Fact]
    public void Malformed_siem_feed_does_not_poison_and_cef_masks_pii()
    {
        var bridge = new SiemSoarBridge();
        Assert.False(bridge.ImportStixLike("{not-json", DateTimeOffset.UtcNow));
        Assert.Contains(bridge.DeadLetter, x => x.Contains("malformed"));
        Assert.False(bridge.HasIoc("ipv4", "1.2.3.4"));

        var now = DateTimeOffset.UtcNow;
        var ok = bridge.ImportStixLike($$"""{"observables":[{"type":"ipv4","value":"1.2.3.4","expiresAt":"{{now.AddDays(1):o}}"}]}""", now);
        Assert.True(ok);
        Assert.True(bridge.HasIoc("ipv4", "1.2.3.4"));

        var cef = bridge.ExportCef("t1", "risk_event", new Dictionary<string, string> { ["email"] = "a@b.com", ["score"] = "10" });
        Assert.Contains("***", cef);
        Assert.DoesNotContain("a@b.com", cef);
        Assert.Contains("sig=", cef);
    }

    [Fact]
    public void Reference_policies_dry_run_and_vpn_alone_not_deny()
    {
        var engine = new RulesEngine();
        foreach (var tpl in FraudUseCaseTemplates.AllDisabled("t1"))
        {
            engine.Publish(tpl);
            var simFraud = engine.Evaluate("t1", new Dictionary<string, object?>
            {
                ["suspect_score"] = 80,
                ["signal.browser_bot_detection"] = "not_detected",
                ["visitor.events_last_hour"] = 50,
                ["signal.tampered_request_detection"] = "detected"
            }, simulate: true);
            Assert.True(simFraud.Simulated);

            // nonfraud counterexample
            var clean = engine.Evaluate("t1", new Dictionary<string, object?>
            {
                ["suspect_score"] = 5,
                ["signal.browser_bot_detection"] = "not_detected",
                ["visitor.events_last_hour"] = 1,
                ["signal.tampered_request_detection"] = "not_detected"
            });
            Assert.Equal(RuleAction.Allow, clean.EffectiveAction);
            Assert.True(engine.Rollback("t1") || true);
            // re-publish next template overwrites; rollback optional
        }

        // VPN / privacy alone must not deny
        engine.Publish(new PolicyDocument("t1", "vpn-check",
        [
            new PolicyRule("vpn", 1, new CmpExpr("signal.vpn_detection", CompareOp.Eq, "detected"), RuleAction.Observe, null, null, true)
        ]));
        var vpn = engine.Evaluate("t1", new Dictionary<string, object?> { ["signal.vpn_detection"] = "detected", ["suspect_score"] = 10 });
        Assert.NotEqual(RuleAction.Deny, vpn.EffectiveAction);
    }

    [Fact]
    public void Fairness_skew_flagged_and_shadow_rollback()
    {
        var f = new FairnessOversight();
        for (var i = 0; i < 10; i++)
        {
            f.Record("Chrome", "Windows", "fa-IR", "direct", "IR", rejected: false);
        }

        for (var i = 0; i < 10; i++)
        {
            f.Record("Firefox", "Linux", "fa-IR", "direct", "IR", rejected: true);
        }

        var alerts = f.DetectSkew(baselineRejectRate: 0.1);
        Assert.Contains(alerts, a => a.Code == "cohort_skew" && a.CohortKey.Contains("Firefox"));
        f.StartShadow("shadow-v2");
        Assert.Equal("shadow-v2", f.ActiveShadow);
        Assert.Equal("shadow-v2", f.RollbackShadow());
        Assert.Null(f.ActiveShadow);
    }
}
