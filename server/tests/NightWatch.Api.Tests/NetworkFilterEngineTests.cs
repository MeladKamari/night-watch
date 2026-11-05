using NightWatch.BuildingBlocks.Filtering;

namespace NightWatch.Api.Tests;

public class NetworkFilterEngineTests
{
    [Fact]
    public void Dry_run_and_active_agree_and_spoofed_headers_ignored()
    {
        var engine = new NetworkFilterEngine();
        engine.UpsertRule(new FilterRule(
            "r_deny_evil",
            "env_a",
            FilterLayer.Edge,
            Precedence: 10,
            FilterAction.Deny,
            AllOf:
            [
                new FilterPredicate(FilterField.Domain, FilterOp.Equals, "evil.example", null)
            ],
            Reason: "domain_denied"));

        engine.UpsertRule(new FilterRule(
            "r_allow_office",
            "env_a",
            FilterLayer.Edge,
            Precedence: 20,
            FilterAction.Allow,
            AllOf:
            [
                new FilterPredicate(FilterField.ClientIp, FilterOp.CidrContains, "203.0.113.0/24", null)
            ],
            Reason: "office_cidr"));

        engine.UpsertRule(new FilterRule(
            "r_risk_asn",
            "env_a",
            FilterLayer.RiskPolicy,
            Precedence: 10,
            FilterAction.Deny,
            AllOf:
            [
                new FilterPredicate(FilterField.Asn, FilterOp.Equals, "AS999", null)
            ],
            Reason: "risk_asn"));

        var ctx = new FilterRequestContext(
            EnvironmentId: "env_a",
            Origin: "https://app.example.ir",
            Domain: "app.example.ir",
            AuthoritativeClientIp: "203.0.113.50",
            ClaimedOriginHeader: "https://evil.example",
            ClaimedForwardedIp: "198.51.100.1",
            Asn: null,
            AsnStatus: "unavailable",
            TrafficClass: "browser",
            LegitimateAutomation: false);

        var dry = engine.Evaluate(ctx, dryRun: true);
        var live = engine.Evaluate(ctx, dryRun: false);

        Assert.Equal(dry.Outcome, live.Outcome);
        Assert.Equal(dry.MatchedEdgeRuleId, live.MatchedEdgeRuleId);
        Assert.Equal("allow", live.Outcome);
        Assert.Equal("r_allow_office", live.MatchedEdgeRuleId);
        // Spoofed evil origin must not trigger deny rule.
        Assert.NotEqual("r_deny_evil", live.MatchedEdgeRuleId);
        // ASN unavailable → risk rule cannot match; safe default path not needed here because edge allow matched.
        Assert.Null(live.MatchedRiskRuleId);

        var stale = engine.Evaluate(ctx with
        {
            AuthoritativeClientIp = "198.51.100.9",
            AsnStatus = "stale",
            Asn = "AS1"
        }, dryRun: false);
        Assert.Equal("allow_default_unavailable", stale.Outcome);

        var automation = engine.Evaluate(ctx with
        {
            AuthoritativeClientIp = "198.51.100.9",
            AsnStatus = "known",
            Asn = "AS1",
            LegitimateAutomation = true
        }, dryRun: false);
        Assert.Equal("allow", automation.Outcome);
        Assert.Equal("legitimate_automation_allowlist", automation.Detail);
    }
}
