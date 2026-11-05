using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class GapClosureV4Tests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public GapClosureV4Tests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Consented_proximity_detects_impossible_travel()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/decisions/evaluate")
        {
            Content = JsonContent.Create(new
            {
                tenantId = "ten_v4",
                businessAction = "login",
                eventId = "ev_prox_1",
                nonce = "nonce_prox_00000001",
                suspectScore = 0,
                proximityConsent = true,
                priorLocationLabel = "ir-tehran",
                currentLocationLabel = "de-frankfurt",
                locationDistanceKm = 3200,
                environmentProbes = new { probeCollected = true, userAgent = "Mozilla/5.0" }
            })
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_v4");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        var prox = json.GetProperty("scoreReceipt").GetProperty("contributions").EnumerateArray()
            .First(c => c.GetProperty("signalId").GetString() == "proximity_detection");
        Assert.True(prox.GetProperty("appliedPoints").GetDouble() > 0);
    }

    [Fact]
    public async Task Local_population_marks_unique_device_rare()
    {
        // Warm common cohort (need enough population for local baseline rarity)
        for (var i = 0; i < 20; i++)
        {
            await DecideAsync("common", new { deviceMemory = 8, hardwareConcurrency = 8, platform = "Win32" });
        }

        // Unique rare attrs
        var rare = await DecideAsync("rare", new { deviceMemory = 0.5, hardwareConcurrency = 1, platform = "Win32", maxTouchPoints = 0 });
        var rareSignal = rare.GetProperty("scoreReceipt").GetProperty("contributions").EnumerateArray()
            .First(c => c.GetProperty("signalId").GetString() == "rare_device_detection");
        Assert.True(rareSignal.GetProperty("appliedPoints").GetDouble() > 0);
    }

    [Fact]
    public async Task Holdout_backed_confidence_after_calibration()
    {
        using var cal = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/calibration/run")
        {
            Content = JsonContent.Create(new { tenantId = "ten_v4_conf", activate = true })
        };
        var calRes = await _client.SendAsync(cal);
        Assert.Equal(HttpStatusCode.OK, calRes.StatusCode);

        var device = new
        {
            platform = "Win32",
            osFamily = "Windows",
            browserFamily = "Chrome",
            locale = "fa-IR",
            screenWidth = 1920,
            screenHeight = 1080
        };

        var idem1 = "v4-conf-" + Guid.NewGuid().ToString("N")[..8];
        using var r1 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(Guid.NewGuid().ToString("N"), idem1, "ten_v4_conf", device))
        };
        r1.Headers.TryAddWithoutValidation("Idempotency-Key", idem1);
        var a = await _client.SendAsync(r1);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var token = ja.GetProperty("continuity").GetProperty("token").GetString();

        var idem2 = "v4-conf-" + Guid.NewGuid().ToString("N")[..8];
        using var r2 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(
                Guid.NewGuid().ToString("N"),
                idem2,
                "ten_v4_conf",
                device,
                token))
        };
        r2.Headers.TryAddWithoutValidation("Idempotency-Key", idem2);
        r2.Headers.TryAddWithoutValidation("X-Continuity-Token", token!);
        var b = await _client.SendAsync(r2);
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("matched", jb.GetProperty("matchType").GetString());
        Assert.Equal("holdout_backed", jb.GetProperty("confidenceStatus").GetString());
        Assert.True(jb.GetProperty("confidence").GetDouble() >= 0.9);
        Assert.Equal("night-watch-identity-v4", jb.GetProperty("identityAlgorithmVersion").GetString());
    }

    [Fact]
    public async Task Expanded_offline_feed_feed_has_operator_and_vpn_samples()
    {
        using var asn = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/network/lookup")
        {
            Content = JsonContent.Create(new { key = "asn:197207" })
        };
        var a = await _client.SendAsync(asn);
        var aj = await a.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ir_operator", aj.GetProperty("kind").GetString());

        using var vpn = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/network/lookup")
        {
            Content = JsonContent.Create(new { key = "ip:198.51.100.105" })
        };
        var v = await _client.SendAsync(vpn);
        var vj = await v.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("vpn", vj.GetProperty("kind").GetString());
    }

    private async Task<JsonElement> DecideAsync(string suffix, object deviceAttrs)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/decisions/evaluate")
        {
            Content = JsonContent.Create(new
            {
                tenantId = "ten_v4_pop",
                businessAction = "checkout",
                eventId = "ev_pop_" + suffix + "_" + Guid.NewGuid().ToString("N")[..6],
                nonce = "nonce_pop_" + Guid.NewGuid().ToString("N")[..10],
                suspectScore = 0,
                environmentProbes = new
                {
                    probeCollected = true,
                    userAgent = "Mozilla/5.0",
                    deviceAttrs
                }
            })
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_v4_pop");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static object IdentifyBody(
        string hash,
        string idem,
        string tenant,
        object device,
        string? continuity = null) => new
    {
        schemaVersion = "night-watch-identify-v1",
        productCode = "night-watch",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        tenantId = tenant,
        projectId = "prj_v4",
        region = "ir-central",
        continuityToken = continuity,
        continuityLegalBasis = "legitimate_interest",
        clientDevice = device,
        legacyBrowser = new
        {
            visitorId = hash,
            sourceManifestRevision = "default-v1",
            componentKeys = new[] { "canvas", "fonts", "audio" }
        }
    };
}
