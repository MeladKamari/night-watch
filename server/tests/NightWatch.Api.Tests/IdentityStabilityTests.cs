using System.Net;
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

        var idem1 = "stable-cont-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-cont-" + Guid.NewGuid().ToString("N")[..8];

        var (a, ja) = await IdentifyFixtures.PostIdentifyAsync(
            _client,
            "stable-hash-1-" + Guid.NewGuid().ToString("N")[..8],
            idem1,
            tenant: "ten_stable",
            project: "prj_stable",
            clientDevice: device);
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("night-watch-identity-v4", ja.GetProperty("identityAlgorithmVersion").GetString());
        var token = ja.GetProperty("continuity").GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Equal("issued", ja.GetProperty("continuity").GetProperty("status").GetString());

        var (b, jb) = await IdentifyFixtures.PostIdentifyAsync(
            _client,
            "stable-hash-2-" + Guid.NewGuid().ToString("N")[..8],
            idem2,
            tenant: "ten_stable",
            project: "prj_stable",
            clientDevice: device,
            continuityToken: token);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);

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
        var salt = "stable-alias-" + Guid.NewGuid().ToString("N")[..8];
        var idem1 = "stable-alias-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-alias-" + Guid.NewGuid().ToString("N")[..8];
        var (a, ja) = await IdentifyFixtures.PostIdentifyAsync(
            _client, salt, idem1, tenant: "ten_stable", project: "prj_stable");
        var (b, jb) = await IdentifyFixtures.PostIdentifyAsync(
            _client, salt, idem2, tenant: "ten_stable", project: "prj_stable");

        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
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
            screenHeight = 1080,
            webGlRenderer = "ANGLE (NVIDIA)"
        };
        var idem1 = "stable-nomerge-" + Guid.NewGuid().ToString("N")[..8];
        var idem2 = "stable-nomerge-" + Guid.NewGuid().ToString("N")[..8];
        var (a, ja) = await IdentifyFixtures.PostIdentifyAsync(
            _client, "nomerge-a-" + Guid.NewGuid().ToString("N")[..8], idem1,
            tenant: "ten_stable", project: "prj_stable", clientDevice: device);
        var (b, jb) = await IdentifyFixtures.PostIdentifyAsync(
            _client, "nomerge-b-" + Guid.NewGuid().ToString("N")[..8], idem2,
            tenant: "ten_stable", project: "prj_stable", clientDevice: device);
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        Assert.NotEqual(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
    }
}
