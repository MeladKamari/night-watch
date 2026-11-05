using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NightWatch.Modules.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Api.Tests;

public class EventQueryApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public EventQueryApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private static object IdentifyBody(string hash, string idem, string tenant = "ten_evt") => new
    {
        schemaVersion = "night-watch-identify-v1",
        productCode = "night-watch",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        tenantId = tenant,
        projectId = "prj_web",
        legacyBrowser = new
        {
            visitorId = hash,
            sourceManifestRevision = "default-v1",
            componentKeys = new[] { "canvas", "fonts", "audio", "timezone", "platform" }
        }
    };

    private async Task<(string VisitorId, string EventId)> IdentifyAsync(string hash, string idem, string tenant = "ten_evt")
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(IdentifyBody(hash, idem, tenant))
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
        var res = await _client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return (json.GetProperty("visitorId").GetString()!, json.GetProperty("eventId").GetString()!);
    }

    [Fact]
    public async Task Access_denial_for_client_key_and_cross_tenant()
    {
        var (visitorId, eventId) = await IdentifyAsync("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "evt-query-deny-00001");

        using var clientKey = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        clientKey.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        clientKey.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "public");
        var denied = await _client.SendAsync(clientKey);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        using var missing = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        missing.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        var unauth = await _client.SendAsync(missing);
        Assert.Equal(HttpStatusCode.Unauthorized, unauth.StatusCode);

        using var cross = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        cross.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_other");
        cross.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var crossRes = await _client.SendAsync(cross);
        Assert.Equal(HttpStatusCode.NotFound, crossRes.StatusCode);

        using var ok = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        ok.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        ok.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var okRes = await _client.SendAsync(ok);
        Assert.Equal(HttpStatusCode.OK, okRes.StatusCode);
        var body = await okRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(visitorId, body.GetProperty("visitorId").GetString());
        Assert.Equal("redacted", body.GetProperty("profile").GetString());
        Assert.Equal("unavailable", body.GetProperty("riskStatus").GetString());
    }

    [Fact]
    public async Task Pagination_stable_across_concurrent_inserts()
    {
        // Seed first page under a dedicated visitor (exact rematch).
        const string hash = "ffffffffffffffffffffffffffffffff";
        var (visitorId, _) = await IdentifyAsync(hash, "evt-page-seed-000001");

        // Additional events for same visitor via rematch with unique idem keys.
        for (var i = 0; i < 5; i++)
        {
            await IdentifyAsync(hash, $"evt-page-more-{i:000000}");
        }

        using var page1Req = new HttpRequestMessage(HttpMethod.Get, $"/v1/visitors/{visitorId}/events?limit=3");
        page1Req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        page1Req.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var page1Res = await _client.SendAsync(page1Req);
        Assert.Equal(HttpStatusCode.OK, page1Res.StatusCode);
        var page1 = await page1Res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(page1.GetProperty("hasMore").GetBoolean());
        var cursor = page1.GetProperty("nextCursor").GetString();
        Assert.False(string.IsNullOrWhiteSpace(cursor));
        var firstIds = page1.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("eventId").GetString()).ToList();
        Assert.Equal(3, firstIds.Count);

        // Concurrent inserts after cursor issued — must not reshuffle previous page.
        var insertTasks = Enumerable.Range(0, 8).Select(i =>
            IdentifyAsync(hash, $"evt-page-conc-{i:000000}"));
        await Task.WhenAll(insertTasks);

        using var page2Req = new HttpRequestMessage(HttpMethod.Get, $"/v1/visitors/{visitorId}/events?limit=3&cursor={Uri.EscapeDataString(cursor!)}");
        page2Req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        page2Req.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var page2Res = await _client.SendAsync(page2Req);
        Assert.Equal(HttpStatusCode.OK, page2Res.StatusCode);
        var page2 = await page2Res.Content.ReadFromJsonAsync<JsonElement>();
        var secondIds = page2.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("eventId").GetString()).ToList();

        Assert.Empty(firstIds.Intersect(secondIds));

        // Re-fetch page1 with same params — stable ids.
        using var page1AgainReq = new HttpRequestMessage(HttpMethod.Get, $"/v1/visitors/{visitorId}/events?limit=3");
        page1AgainReq.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_evt");
        page1AgainReq.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var again = await (await _client.SendAsync(page1AgainReq)).Content.ReadFromJsonAsync<JsonElement>();
        var againIds = again.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("eventId").GetString()).ToList();
        Assert.Equal(firstIds, againIds);
    }

    [Fact]
    public async Task Deleted_event_returns_410()
    {
        var (_, eventId) = await IdentifyAsync("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01", "evt-deleted-0000001", tenant: "ten_del");
        using var scope = _factory.Services.CreateScope();
        var catalog = scope.ServiceProvider.GetRequiredService<IIdentificationEventCatalog>();
        var existing = catalog.GetByEventId(eventId)!;
        catalog.Upsert(existing with { DeletedAt = DateTimeOffset.UtcNow, EventStatus = "deleted" });

        using var req = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_del");
        req.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Gone, res.StatusCode);
    }
}
