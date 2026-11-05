using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class IdentityStabilityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public IdentityStabilityTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private static object Body(
        string legacyHash,
        string idem,
        string? continuityToken = null,
        object? clientDevice = null) => new
    {
        schemaVersion = "night-watch-identify-v1",
        productCode = "night-watch",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        tenantId = "ten_stable",
        projectId = "prj_stable",
        region = "ir-central",
        continuityToken,
        continuityLegalBasis = "legitimate_interest",
        clientDevice,
        legacyBrowser = new
        {
            visitorId = legacyHash,
            sourceManifestRevision = "default-v1",
            componentKeys = new[] { "canvas", "fonts", "audio", "timezone", "platform" }
        }
    };

    private static HttpRequestMessage Post(object body, string idem)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
        return req;
    }

    [Fact]
    public async Task Continuity_token_rematches_same_visitor_across_new_legacy_hash()
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

        var hash1 = Guid.NewGuid().ToString("N");
        var hash2 = Guid.NewGuid().ToString("N");
        var idem1 = "stable-cont-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-cont-" + Guid.NewGuid().ToString("N")[..8];

        using var r1 = Post(Body(hash1, idem1, clientDevice: device), idem1);
        var a = await _client.SendAsync(r1);
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("night-watch-identity-v4", ja.GetProperty("identityAlgorithmVersion").GetString());
        var token = ja.GetProperty("continuity").GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Equal("issued", ja.GetProperty("continuity").GetProperty("status").GetString());

        // New legacy hash + same continuity → same visitor (stability), not a new create.
        using var r2 = Post(
            Body(hash2, idem2, continuityToken: token, clientDevice: device),
            idem2);
        var b = await _client.SendAsync(r2);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("matched", jb.GetProperty("matchType").GetString());
        Assert.Equal("heuristic", jb.GetProperty("confidenceStatus").GetString());
        Assert.True(jb.GetProperty("confidence").GetDouble() >= 0.9);
        Assert.Contains("exact_alias_plus_continuity", jb.GetProperty("confidenceNote").GetString());
        Assert.Equal("renewed", jb.GetProperty("continuity").GetProperty("status").GetString());
    }

    [Fact]
    public async Task Exact_alias_reports_heuristic_confidence_without_claiming_calibrated()
    {
        var hash = Guid.NewGuid().ToString("N");
        var idem1 = "stable-alias-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-alias-" + Guid.NewGuid().ToString("N")[..8];
        using var r1 = Post(Body(hash, idem1), idem1);
        using var r2 = Post(Body(hash, idem2), idem2);
        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("unavailable", ja.GetProperty("confidenceStatus").GetString());
        Assert.Equal("matched", jb.GetProperty("matchType").GetString());
        Assert.Equal("heuristic", jb.GetProperty("confidenceStatus").GetString());
        Assert.True(jb.GetProperty("confidence").GetDouble() >= 0.8);
        Assert.DoesNotContain("calibrated", jb.GetProperty("confidenceStatus").GetString());
    }

    [Fact]
    public async Task Similar_browsers_still_not_merged_without_continuity()
    {
        var device = new
        {
            platform = "Win32",
            osFamily = "Windows",
            browserFamily = "Chrome",
            locale = "fa-IR",
            screenWidth = 1920,
            screenHeight = 1080
        };

        var idem1 = "stable-sim-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-sim-" + Guid.NewGuid().ToString("N")[..8];
        using var r1 = Post(Body(Guid.NewGuid().ToString("N"), idem1, clientDevice: device), idem1);
        using var r2 = Post(Body(Guid.NewGuid().ToString("N"), idem2, clientDevice: device), idem2);
        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", jb.GetProperty("matchType").GetString());
        Assert.True(jb.GetProperty("matchInsights").GetProperty("softLinked").GetBoolean());
    }
}
