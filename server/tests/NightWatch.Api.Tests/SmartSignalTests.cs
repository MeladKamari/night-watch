using NightWatch.Modules.Risk.SmartSignals;

namespace NightWatch.Api.Tests;

public class SmartSignalTests
{
    private static SmartSignalInput Browser(
        string? ua = null,
        bool? headless = null,
        bool? webdriver = null,
        bool? a11y = null,
        bool? crawler = null,
        bool? ai = null,
        int? events = null,
        string? asn = null,
        bool? vpn = null) =>
        new(ua, headless, webdriver, a11y, crawler, ai, events, null, null, null, null, null, null, null, asn, vpn, null, null, "browser");

    [Fact]
    public void Bot_ai_activity_vpn_unavailable_and_modes()
    {
        var reg = new SmartSignalRegistry();
        Assert.True(reg.RegisteredIds.Count >= 21);

        Assert.Equal("good_bot", reg.Evaluate("browser_bot_detection", Browser(ua: "Googlebot", crawler: true)).Value);
        Assert.Equal("bad_bot", reg.Evaluate("browser_bot_detection", Browser(ua: "HeadlessChrome", headless: true, webdriver: true)).Value);
        Assert.Equal("not_detected", reg.Evaluate("browser_bot_detection", Browser(ua: "Mozilla/5.0", a11y: true)).Value);
        Assert.Equal("unknown", reg.Evaluate("browser_bot_detection", Browser()).Status);

        Assert.Equal(
            "suspected_ai_agent",
            reg.Evaluate(
                "ai_agent_detection",
                Browser(ua: "Mozilla/5.0 openai-operator", webdriver: true) with
                {
                    ProbeCollected = true,
                    AutomationArtifacts = ["navigator.webdriver", "window.__playwright"]
                }).Value);
        Assert.Equal(
            "suspected_ai_agent",
            reg.Evaluate(
                "ai_agent_detection",
                Browser(ua: "Mozilla/5.0") with
                {
                    ProbeCollected = true,
                    SignatureAgent = "\"https://chatgpt.com\""
                }).Value);
        Assert.Equal(
            "not_detected",
            reg.Evaluate(
                "ai_agent_detection",
                Browser(ua: "Mozilla/5.0 HeadlessChrome", webdriver: true) with
                {
                    ProbeCollected = true,
                    CdpSideEffect = true,
                    AutomationArtifacts = ["navigator.webdriver", "cdp.side_effect"]
                }).Value);
        Assert.Equal(
            "not_detected",
            reg.Evaluate("ai_agent_detection", Browser(ua: "Mozilla/5.0") with { ProbeCollected = true }).Value);
        // Fake toggles must not create AI detections.
        Assert.Equal(
            "not_detected",
            reg.Evaluate("ai_agent_detection", Browser(ua: "Mozilla/5.0", ai: true) with { ProbeCollected = true }).Value);
        Assert.Equal("high", reg.Evaluate("high_activity_device", Browser(events: 250)).Value);
        Assert.Equal("unavailable", reg.Evaluate("vpn_detection", Browser(asn: "stale")).Status);

        Assert.Equal("unsupported", reg.Evaluate("browser_bot_detection", Browser() with { Platform = "native_unsupported" }).Status);

        reg.SetMode("browser_bot_detection", "disabled");
        Assert.Equal("not_applicable", reg.Evaluate("browser_bot_detection", Browser(webdriver: true)).Status);
    }
}
