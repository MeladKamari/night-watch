using NightWatch.Modules.Risk.Rules;

namespace NightWatch.Api.Tests;

public class RulesDslTests
{
    [Fact]
    public void Deterministic_priority_and_simulation()
    {
        var engine = new RulesEngine();
        var doc = new PolicyDocument("t1", "rev1",
        [
            new PolicyRule("r-deny", 100,
                new AndExpr([
                    new CmpExpr("suspect_score", CompareOp.Gte, 70),
                    new CmpExpr("signal.browser_bot_detection", CompareOp.Eq, "detected")
                ]),
                RuleAction.Deny, Scope: null, Exceptions: null, DryRun: false),
            new PolicyRule("r-review", 50,
                new CmpExpr("suspect_score", CompareOp.Gte, 40),
                RuleAction.ManualReview, Scope: "/checkout", Exceptions: null, DryRun: false)
        ]);
        engine.Publish(doc);

        var facts = new Dictionary<string, object?>
        {
            ["suspect_score"] = 80,
            ["signal.browser_bot_detection"] = "detected",
            ["request.path"] = "/checkout/pay",
            ["tenant.id"] = "t1"
        };

        var a = engine.Evaluate("t1", facts);
        var b = engine.Evaluate("t1", facts);
        Assert.Equal(a.EffectiveAction, b.EffectiveAction);
        Assert.Equal(RuleAction.Deny, a.EffectiveAction);
        Assert.Contains(a.Matches, m => m.RuleId == "r-deny");

        var sim = engine.Evaluate("t1", facts, simulate: true);
        Assert.Equal(RuleAction.Observe, sim.EffectiveAction);
        Assert.True(sim.Simulated);
    }

    [Fact]
    public void Blocks_injection_fields_and_supports_rollback()
    {
        var engine = new RulesEngine();
        var bad = new PolicyDocument("t1", "bad",
        [
            new PolicyRule("x", 1, new CmpExpr("System.Diagnostics.Process", CompareOp.Eq, "1"), RuleAction.Deny, null, null, false)
        ]);
        Assert.Throws<InvalidOperationException>(() => engine.Publish(bad));

        engine.Publish(new PolicyDocument("t1", "rev1",
        [
            new PolicyRule("allow-all", 1, new CmpExpr("suspect_score", CompareOp.Lt, 0), RuleAction.Allow, null, null, false)
        ]));
        engine.Publish(new PolicyDocument("t1", "rev2",
        [
            new PolicyRule("deny-high", 1, new CmpExpr("suspect_score", CompareOp.Gte, 1), RuleAction.Deny, null, null, false)
        ]));

        Assert.Equal(RuleAction.Deny, engine.Evaluate("t1", new Dictionary<string, object?> { ["suspect_score"] = 5 }).EffectiveAction);
        Assert.True(engine.Rollback("t1"));
        Assert.Equal(RuleAction.Allow, engine.Evaluate("t1", new Dictionary<string, object?> { ["suspect_score"] = 5 }).EffectiveAction);
    }
}
