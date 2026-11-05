using System.Text.Json;
using NightWatch.Modules.Risk.Ai;
using NightWatch.Modules.Risk.Behavior;
using NightWatch.Modules.Risk.Bots;
using NightWatch.Modules.Risk.Decisions;
using NightWatch.Modules.Risk.Reputation;
using NightWatch.Modules.Risk.Rules;

namespace NightWatch.Api.Tests;

public class RiskTrack076_080Tests
{
    [Fact]
    public void Decisions_observe_default_forged_challenge_denied_idempotent()
    {
        var rules = new RulesEngine();
        rules.Publish(new PolicyDocument("t1", "p1",
        [
            new PolicyRule("deny", 10, new CmpExpr("suspect_score", CompareOp.Gte, 1), RuleAction.Deny, null, null, false)
        ]));
        var orch = new DecisionOrchestrator(rules, observeOnlyDefault: true);
        var r1 = orch.Evaluate(new DecisionEvaluateRequest("t1", "checkout", "e1", "n1", 90, new Dictionary<string, object?>(), "https://evil.example/phish"));
        Assert.Equal("observe", r1.Action);
        Assert.True(r1.DefaultObserveOnly);
        Assert.Null(r1.Challenge?.AllowlistedRedirect); // not on allowlist

        var forged = orch.CompleteChallenge("t1", "e1", "n1", "deadbeefdeadbeef", true);
        Assert.Equal("deny", forged.Action);
        Assert.Contains("forged_challenge", forged.Reasons);

        var rules2 = new RulesEngine();
        rules2.Publish(new PolicyDocument("t1", "p2",
        [
            new PolicyRule("chal", 10, new CmpExpr("suspect_score", CompareOp.Gte, 1), RuleAction.Challenge, null, null, false)
        ]));
        var orch2 = new DecisionOrchestrator(rules2, redirectAllowlist: ["https://app.local/challenge"], observeOnlyDefault: false);
        var d = orch2.Evaluate(new DecisionEvaluateRequest("t1", "checkout", "e2", "n2", 90, new Dictionary<string, object?>(), "https://app.local/challenge/ok"));
        Assert.Equal("challenge", d.Action);
        Assert.NotNull(d.Challenge);
        Assert.Equal("https://app.local/challenge/ok", d.Challenge!.AllowlistedRedirect);
        var ok = orch2.CompleteChallenge("t1", "e2", "n2", d.Challenge.ChallengeId, true);
        Assert.Equal("allow", ok.Action);
        var again = orch2.Evaluate(new DecisionEvaluateRequest("t1", "checkout", "e2", "n2", 90, new Dictionary<string, object?>(), null));
        Assert.Equal("allow", again.Action); // idempotent completed challenge
    }

    [Fact]
    public void Bot_identity_signed_ok_forged_fail_allowlist()
    {
        const string key = "night-watch-dev-bot-anchor";
        var v = new BotIdentityVerifier(key);
        var now = DateTimeOffset.UtcNow;
        var good = BotIdentityVerifier.MintForTests(key, "googlebot", "g1", now);
        Assert.Equal(BotIdentityClass.VerifiedGoodBot, v.Verify("t1", "Googlebot", good, now).Classification);
        Assert.Equal(BotIdentityClass.SpoofedUserAgent, v.Verify("t1", "Googlebot", "bot1.xxx.yyy", now).Classification);
        Assert.Equal(BotIdentityClass.SpoofedUserAgent, v.Verify("t1", "Googlebot/2.1", null, now).Classification);
        v.AllowlistPrivateBot("t1", "internal-scanner");
        Assert.Equal(BotIdentityClass.PrivateAllowlistedBot, v.Verify("t1", null, null, now, "internal-scanner").Classification);
    }

    [Fact]
    public void Asn_feed_signature_license_and_stale()
    {
        const string key = "night-watch-dev-feed-signing-key";
        var store = new AsnReputationStore(key);
        var now = DateTimeOffset.UtcNow;
        var records = new List<ReputationRecord>
        {
            new("asn:197207", "ir_operator", "MCI", now.AddDays(30), "lab"),
            new("tag:tor", "tor", "exit", now.AddDays(30), "lab")
        };
        var json = JsonSerializer.Serialize(records);
        var sig = AsnReputationStore.SignForTests(key, json);
        var bad = store.ImportSignedBundle(json, "00", "lab_synthetic_v1", now);
        Assert.Equal("rejected_signature", bad.Status);
        var lic = store.ImportSignedBundle(json, sig, "foreign_saas", now);
        Assert.Equal("rejected_license", lic.Status);
        var ok = store.ImportSignedBundle(json, sig, "lab_synthetic_v1", now);
        Assert.Equal("imported", ok.Status);
        Assert.Equal("known", store.Lookup("asn:197207", now).Status);
        Assert.Equal("unknown", store.Lookup("asn:999999", now).Status);

        store.AnalystOverride(new ReputationRecord("tag:tor", "tor", "cleared", now.AddDays(1), "analyst"));
        Assert.Equal("cleared", store.Lookup("tag:tor", now).Record!.Label);
    }

    [Fact]
    public void Ai_mock_inference_no_gpu_with_fallback()
    {
        var host = new AiScoringPluginHost();
        var r = host.Score(new InferenceRequest("t1", "mock-risk", new Dictionary<string, double> { ["bot"] = 0.9, ["velocity"] = 0.1, ["tamper"] = 0.2 }));
        Assert.Equal("scored", r.Status);
        Assert.Equal("mock_baseline", r.Kind);
        Assert.True(r.LatencyMs >= 0);
        Assert.InRange(r.Score!.Value, 0, 1);
        Assert.Equal("unsupported", host.Score(new InferenceRequest("t1", "missing", new Dictionary<string, double>())).Status);
    }

    [Fact]
    public void Behavior_disabled_by_default_no_invasive_telemetry()
    {
        var mod = new BehaviorVelocityModule();
        Assert.False(mod.Enabled);
        mod.Record(new BehaviorEvent("t1", "acc", BehaviorEventType.LoginFailure, DateTimeOffset.UtcNow, null));
        Assert.Equal("disabled", mod.Aggregate("t1", "acc", DateTimeOffset.UtcNow, TimeSpan.FromHours(1)).Status);

        mod.Enabled = true;
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 5; i++)
        {
            mod.Record(new BehaviorEvent("t1", "acc", BehaviorEventType.LoginFailure, now, "terminal-a"));
        }

        var agg = mod.Aggregate("t1", "acc", now, TimeSpan.FromHours(1));
        Assert.Equal("known", agg.Status);
        Assert.Equal(5, agg.LoginFailures);
    }
}
