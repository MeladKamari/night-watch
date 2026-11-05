using NightWatch.Modules.Risk.SmartSignals;

namespace NightWatch.Api.Tests;

public class UnifiedSignalRegistryTests
{
    private static SmartSignalInput Browser(
        string? ua = null,
        bool? headless = null,
        bool? webdriver = null,
        bool? a11y = null,
        bool? crawler = null,
        bool? ai = null,
        int? events = null,
        string? asn = "known") =>
        new(ua, headless, webdriver, a11y, crawler, ai, events, null, null, null, null, null, null, null, asn, null, null, null, "browser");

    [Fact]
    public void Catalog_has_21_web_and_10_deferred_native_never_evaluated()
    {
        var reg = new UnifiedSignalRegistry();
        Assert.Equal(21, UnifiedSignalRegistry.WebServerSignalIds.Count);
        Assert.Equal(10, UnifiedSignalRegistry.NativeDeferredSignalIds.Count);
        Assert.Equal(31, reg.Catalog.Count);
        Assert.Equal(21, reg.Catalog.Count(c => c.Evaluable));
        Assert.Equal(10, reg.Catalog.Count(c => !c.Evaluable && c.Channel == "native_deferred"));

        var deferred = reg.Evaluate("frida_detection", Browser());
        Assert.Equal("unsupported", deferred.Status);
        Assert.Equal(DetectionTriState.Unknown, deferred.TriState);
        Assert.Contains("never_evaluated", deferred.Evidence);
    }

    [Fact]
    public void Unknown_is_not_conflated_with_not_detected()
    {
        var reg = new UnifiedSignalRegistry();
        var missing = reg.Evaluate("browser_bot_detection", Browser());
        Assert.Equal("unknown", missing.Status);
        Assert.Equal(DetectionTriState.Unknown, missing.TriState);

        var clean = reg.Evaluate("browser_bot_detection", Browser(ua: "Mozilla/5.0"));
        Assert.Equal("not_detected", clean.Value);
        Assert.Equal("not_detected", clean.Status);
        Assert.Equal(DetectionTriState.NotDetected, clean.TriState);

        var a11y = reg.Evaluate("browser_bot_detection", Browser(ua: "Mozilla/5.0", a11y: true));
        Assert.Equal("not_detected", a11y.Value);
        Assert.Equal(DetectionTriState.NotDetected, a11y.TriState);

        var bot = reg.Evaluate("browser_bot_detection", Browser(ua: "HeadlessChrome", headless: true, webdriver: true));
        Assert.Equal("detected", bot.Status);
        Assert.Equal(DetectionTriState.Detected, bot.TriState);
        Assert.Equal("bad_bot", bot.Value);
    }

    [Fact]
    public void EvaluateAllWeb_runs_21_with_provenance_and_cache()
    {
        var reg = new UnifiedSignalRegistry(cacheTtl: TimeSpan.FromMinutes(1));
        var input = Browser(ua: "Mozilla/5.0", events: 10, asn: "known");
        var first = reg.EvaluateAllWeb(input, cacheKeySuffix: "t1");
        Assert.Equal(21, first.Count);
        Assert.All(first, o =>
        {
            Assert.False(string.IsNullOrWhiteSpace(o.Provenance.ModelVersion));
            Assert.Equal("smart_signal_evaluator", o.Provenance.Source);
            Assert.Equal("browser", o.Provenance.PlatformAvailability);
            Assert.False(o.FromCache);
        });

        var again = reg.Evaluate("browser_bot_detection", input, cacheKeySuffix: "t1");
        Assert.True(again.FromCache);

        reg.Invalidate("browser_bot_detection");
        var fresh = reg.Evaluate("browser_bot_detection", input, cacheKeySuffix: "t1");
        Assert.False(fresh.FromCache);
    }

    [Fact]
    public void NormalizeStatus_preserves_unavailable_as_unknown_tri()
    {
        var (status, tri) = UnifiedSignalRegistry.NormalizeStatus("unavailable", null);
        Assert.Equal("unavailable", status);
        Assert.Equal(DetectionTriState.Unknown, tri);

        var (u, ut) = UnifiedSignalRegistry.NormalizeStatus("unknown", null);
        Assert.Equal("unknown", u);
        Assert.Equal(DetectionTriState.Unknown, ut);
        Assert.NotEqual(DetectionTriState.NotDetected, ut);
    }
}
