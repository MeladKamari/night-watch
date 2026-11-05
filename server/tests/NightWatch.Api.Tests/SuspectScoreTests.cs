using NightWatch.Modules.Risk.SmartSignals;
using NightWatch.Modules.Risk.SuspectScore;

namespace NightWatch.Api.Tests;

public class SuspectScoreTests
{
    private static SmartSignalInput Browser(string? ua = null, bool? headless = null, bool? webdriver = null, int? events = null) =>
        new(ua, headless, webdriver, null, null, null, events, null, null, null, null, null, null, null, "known", null, null, null, "browser");

    [Fact]
    public void Deterministic_heuristic_score_and_unknown_not_scored()
    {
        var signals = new UnifiedSignalRegistry();
        var engine = new SuspectScoreEngine();
        var outcomes = signals.EvaluateAllWeb(Browser());
        var a = engine.Score("default", outcomes);
        var b = engine.Score("default", outcomes);

        Assert.Equal(a.Score, b.Score);
        Assert.Equal(SuspectScoreEngine.BaselineVersion, a.Version);
        Assert.Equal("heuristic_weighted", a.ScoreKind);
        Assert.Equal(0, a.Score); // unknowns contribute 0, never false-negative points
        Assert.True(a.UnknownSignals.Count > 0);
        Assert.Equal("allow", a.Decision);
    }

    [Fact]
    public void Monotonic_more_detections_raise_score()
    {
        var signals = new UnifiedSignalRegistry();
        var engine = new SuspectScoreEngine();

        var clean = engine.Score("default", signals.EvaluateAllWeb(Browser(ua: "Mozilla/5.0")));
        var bot = engine.Score("default", signals.EvaluateAllWeb(Browser(ua: "HeadlessChrome", headless: true, webdriver: true)));
        Assert.True(bot.Score > clean.Score);
        Assert.Contains(bot.Contributions, c => c.SignalId == "browser_bot_detection" && c.AppliedPoints > 0);
        Assert.DoesNotContain(bot.ReasonCodes, r => r.Contains("99%", StringComparison.Ordinal));
    }

    [Fact]
    public void Tenant_thresholds_and_shadow_mode()
    {
        var signals = new UnifiedSignalRegistry();
        var engine = new SuspectScoreEngine();
        engine.UpsertPolicy(new TenantScorePolicy(
            "bank-a",
            "suspect-score-v1-heuristic",
            "shadow",
            ReviewThreshold: 10,
            DenyThreshold: 20,
            new Dictionary<string, double> { ["browser_bot_detection"] = 50 }));

        var bot = engine.Score("bank-a", signals.EvaluateAllWeb(Browser(ua: "HeadlessChrome", headless: true, webdriver: true)));
        Assert.Equal("shadow", bot.Decision);
        Assert.Equal("shadow", bot.Mode);
        Assert.True(bot.Score >= 50);
    }
}
