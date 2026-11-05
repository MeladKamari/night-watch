using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NightWatch.Modules.Identity.Matching;
using NightWatch.Modules.Risk.Reputation;
using NightWatch.Modules.Risk.Feedback;
using NightWatch.Modules.Risk.SuspectScore;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class BeatProWaveTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public BeatProWaveTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private static object IdentifyBody(
        string legacyHash,
        string idem,
        object? clientDevice = null,
        object? environmentProbes = null) => new
    {
        schemaVersion = "night-watch-identify-v1",
        productCode = "night-watch",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        tenantId = "ten_beat",
        projectId = "prj_beat",
        region = "ir-central",
        clientDevice,
        environmentProbes,
        legacyBrowser = new
        {
            visitorId = legacyHash,
            sourceManifestRevision = "default-v1",
            componentKeys = new[] { "canvas", "fonts", "audio", "timezone", "platform" }
        }
    };

    [Fact]
    public async Task Fuzzy_insights_soft_link_without_merging_visitor_ids()
    {
        var device = new
        {
            platform = "Win32",
            osFamily = "Windows",
            browserFamily = "Chrome",
            locale = "fa-IR",
            screenWidth = 1920,
            screenHeight = 1080,
            webGlRenderer = "ANGLE (NVIDIA)"
        };

        var idem1 = "beat-fuzzy-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "beat-fuzzy-" + Guid.NewGuid().ToString("N")[..8];
        using var r1 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(Guid.NewGuid().ToString("N"), idem1, device))
        };
        r1.Headers.TryAddWithoutValidation("Idempotency-Key", idem1);

        using var r2 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(Guid.NewGuid().ToString("N"), idem2, device))
        };
        r2.Headers.TryAddWithoutValidation("Idempotency-Key", idem2);

        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);

        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();

        Assert.NotEqual(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("created", jb.GetProperty("matchType").GetString());

        var insights = jb.GetProperty("matchInsights");
        Assert.Equal("scored", insights.GetProperty("status").GetString());
        Assert.True(insights.GetProperty("softLinked").GetBoolean());
        Assert.Equal(ja.GetProperty("visitorId").GetString(), insights.GetProperty("bestCandidateVisitorId").GetString());
        Assert.Equal("match", insights.GetProperty("bestDecision").GetString());
    }

    [Fact]
    public async Task Identify_attaches_smart_signals_from_observed_probes()
    {
        var probes = new
        {
            probeCollected = true,
            userAgent = "Mozilla/5.0 HeadlessChrome/120.0.0.0",
            navigatorWebdriver = true,
            headlessUa = true,
            automationArtifacts = new[] { "navigator.webdriver" }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(
                "12121212121212121212121212121212",
                "beat-probes-0000001",
                environmentProbes: probes))
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", "beat-probes-0000001");

        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, json.GetProperty("smartSignals").ValueKind);
        Assert.True(json.GetProperty("smartSignals").GetArrayLength() > 0);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("scoreReceipt").ValueKind);
        Assert.True(json.GetProperty("scoreReceipt").GetProperty("score").GetInt32() >= 0);
    }

    [Fact]
    public async Task Lab_accuracy_harness_endpoint_passes_synthetic_scenarios()
    {
        var res = await _client.GetAsync("/v1/lab/accuracy");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(AccuracyHarness.ReportVersion, json.GetProperty("reportVersion").GetString());
        Assert.Equal(json.GetProperty("scenarioCount").GetInt32(), json.GetProperty("passCount").GetInt32());
        Assert.Equal(1.0, json.GetProperty("passRate").GetDouble());
        Assert.Equal("unavailable", json.GetProperty("calibrationStatus").GetString());
    }

    [Fact]
    public async Task Lab_network_lookup_returns_seeded_vpn_ip()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/network/lookup")
        {
            Content = JsonContent.Create(new { key = "ip:203.0.113.10" })
        };
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("known", json.GetProperty("status").GetString());
        Assert.Equal("vpn", json.GetProperty("kind").GetString());
    }

    [Fact]
    public async Task Decisions_vpn_hint_from_offline_reputation()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/decisions/evaluate")
        {
            Content = JsonContent.Create(new
            {
                tenantId = "ten_beat",
                businessAction = "checkout",
                eventId = "ev_vpn_lab_1",
                nonce = "nonce_vpn_lab_0001",
                suspectScore = 0,
                environmentProbes = new { probeCollected = true, userAgent = "Mozilla/5.0" }
            })
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_beat");
        req.Headers.TryAddWithoutValidation("X-Client-Ip", "203.0.113.10");

        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        var receipt = json.GetProperty("scoreReceipt");
        Assert.True(receipt.GetProperty("serverAuthoritative").GetBoolean());
        var vpnPoints = receipt.GetProperty("contributions").EnumerateArray()
            .Where(c => c.GetProperty("signalId").GetString() == "vpn_detection")
            .Select(c => c.GetProperty("appliedPoints").GetDouble())
            .FirstOrDefault();
        Assert.True(vpnPoints > 0, "offline VPN IP reputation should apply vpn_detection points");
    }

    [Fact]
    public void Feedback_trainer_reweights_transparently()
    {
        var engine = new SuspectScoreEngine();
        var pipe = new FraudFeedbackPipeline();
        var trainer = new SuspectScoreFeedbackTrainer(engine, pipe);
        var before = engine.GetPolicy("default").Weights["vpn_detection"];
        var result = trainer.Apply("default", "case_1", "vh_abc123deadbeef", "fraud", "analyst");
        var after = engine.GetPolicy("default").Weights["vpn_detection"];
        Assert.True(after > before);
        Assert.Contains("applied", result.ToString()!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Network_bootstrap_rejects_unsigned_bundle()
    {
        var store = new AsnReputationStore("test-key");
        var bad = store.ImportSignedBundle("[]", "deadbeef", "lab_synthetic_v1", DateTimeOffset.UtcNow);
        Assert.False(bad.Accepted);
        Assert.Equal("rejected_signature", bad.Status);
    }
}
