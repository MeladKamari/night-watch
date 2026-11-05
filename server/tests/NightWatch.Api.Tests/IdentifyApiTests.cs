using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class IdentifyApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public IdentifyApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private static object Body(
        string legacyHash,
        string idem,
        string tenant = "ten_a",
        string project = "prj_web",
        string[]? components = null) => new
    {
        schemaVersion = "night-watch-identify-v1",
        productCode = "night-watch",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        tenantId = tenant,
        projectId = project,
        region = "ir-central",
        clientVisitorId = "ignored_client_authority",
        clientConfidence = 0.99,
        legacyBrowser = new
        {
            visitorId = legacyHash,
            sourceManifestRevision = "default-v1",
            componentKeys = components ?? ["canvas", "fonts", "audio", "timezone", "platform"]
        }
    };

    private static HttpRequestMessage Post(object body, string? idemHeader = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        if (idemHeader is not null)
        {
            req.Headers.TryAddWithoutValidation("Idempotency-Key", idemHeader);
        }

        return req;
    }

    [Fact]
    public async Task Same_request_is_idempotent()
    {
        const string hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string idem = "identify-idem-00000001";
        using var r1 = Post(Body(hash, idem), idem);
        using var r2 = Post(Body(hash, idem), idem);

        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);

        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal(ja.GetProperty("eventId").GetString(), jb.GetProperty("eventId").GetString());
        Assert.False(ja.GetProperty("duplicate").GetBoolean());
        Assert.True(jb.GetProperty("duplicate").GetBoolean());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("pending", ja.GetProperty("enrichmentStatus").GetString());
        Assert.Equal("unavailable", ja.GetProperty("confidenceStatus").GetString());
        Assert.Equal(JsonValueKind.Null, ja.GetProperty("confidence").ValueKind);
        Assert.StartsWith("r1.", ja.GetProperty("receipt").GetString());
        Assert.StartsWith("v_", ja.GetProperty("visitorId").GetString());
    }

    [Fact]
    public async Task Similar_browsers_are_not_auto_merged()
    {
        var similarComponents = new[] { "canvas", "fonts", "audio", "timezone", "platform" };
        const string hashUser1 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        const string hashUser2 = "cccccccccccccccccccccccccccccccc";

        using var r1 = Post(Body(hashUser1, "identify-user1-0000001", components: similarComponents), "identify-user1-0000001");
        using var r2 = Post(Body(hashUser2, "identify-user2-0000001", components: similarComponents), "identify-user2-0000001");

        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);

        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("created", jb.GetProperty("matchType").GetString());
    }

    [Fact]
    public async Task Exact_alias_rematch_returns_matched()
    {
        const string hash = "dddddddddddddddddddddddddddddddd";
        using var first = Post(Body(hash, "identify-rematch-00001"), "identify-rematch-00001");
        using var second = Post(Body(hash, "identify-rematch-00002"), "identify-rematch-00002");

        var a = await _client.SendAsync(first);
        var b = await _client.SendAsync(second);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("matched", jb.GetProperty("matchType").GetString());
        Assert.NotEqual(ja.GetProperty("eventId").GetString(), jb.GetProperty("eventId").GetString());
    }
}
