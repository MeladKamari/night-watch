using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class Closure100WaveTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public Closure100WaveTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Offline_geo_and_blocklist_feeds_resolve()
    {
        using var geo = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/network/lookup")
        {
            Content = JsonContent.Create(new { key = "ip:5.52.0.1" })
        };
        var g = await _client.SendAsync(geo);
        var gj = await g.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("known", gj.GetProperty("status").GetString());
        Assert.Equal("country", gj.GetProperty("kind").GetString());

        using var abuse = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/network/lookup")
        {
            Content = JsonContent.Create(new { key = "ip:192.0.2.50" })
        };
        var a = await _client.SendAsync(abuse);
        var aj = await a.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("abuse", aj.GetProperty("kind").GetString());
    }

    [Fact]
    public async Task Decisions_apply_velocity_and_offline_blocklist()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/decisions/evaluate")
        {
            Content = JsonContent.Create(new
            {
                tenantId = "ten_100",
                businessAction = "checkout",
                eventId = "ev_100_block",
                nonce = "nonce_100_block_01",
                suspectScore = 0,
                environmentProbes = new
                {
                    probeCollected = true,
                    userAgent = "Mozilla/5.0 Chrome/120",
                    platform = "Win32",
                    deviceMemory = 8,
                    hardwareConcurrency = 8,
                    webGlRenderer = "ANGLE (NVIDIA)"
                }
            })
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_100");
        req.Headers.TryAddWithoutValidation("X-Client-Ip", "192.0.2.50");

        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        var receipt = json.GetProperty("scoreReceipt");
        Assert.True(receipt.GetProperty("serverAuthoritative").GetBoolean());
        var block = receipt.GetProperty("contributions").EnumerateArray()
            .First(c => c.GetProperty("signalId").GetString() == "ip_blocklist_matching");
        Assert.True(block.GetProperty("appliedPoints").GetDouble() > 0);
    }

    [Fact]
    public async Task Identify_with_probes_marks_enrichment_completed()
    {
        var idem = "closure-enrich-" + Guid.NewGuid().ToString("N")[..8];
        var probes = new
        {
            probeCollected = true,
            userAgent = "Mozilla/5.0",
            navigatorWebdriver = false,
            automationArtifacts = Array.Empty<string>(),
            platform = "Win32",
            deviceMemory = 8,
            hardwareConcurrency = 4
        };
        var (res, json) = await IdentifyFixtures.PostIdentifyAsync(
            _client,
            "closure-enrich-" + Guid.NewGuid().ToString("N")[..8],
            idem,
            tenant: "ten_100",
            project: "prj_100",
            environmentProbes: probes);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("completed", json.GetProperty("enrichmentStatus").GetString());
        Assert.Equal("night-watch-identity-v4", json.GetProperty("identityAlgorithmVersion").GetString());
        Assert.Equal(JsonValueKind.Array, json.GetProperty("smartSignals").ValueKind);
    }

    [Fact]
    public async Task Lab_calibration_returns_holdout_metrics_without_claiming_ml()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/calibration/run")
        {
            Content = JsonContent.Create(new { tenantId = "ten_cal", activate = true })
        };
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("holdoutCount").GetInt32() >= 1);
        Assert.Equal("synthetic", json.GetProperty("datasetKind").GetString());
        Assert.Contains("not_production_calibrated", json.GetProperty("confidenceClaim").GetString());
    }
}
