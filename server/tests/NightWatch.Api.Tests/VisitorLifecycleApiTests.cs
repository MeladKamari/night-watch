using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class VisitorLifecycleApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public VisitorLifecycleApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private async Task<(string VisitorId, string EventId, string Hash)> IdentifyAsync(string? hash = null, string? idem = null)
    {
        hash ??= Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant()[..32];
        idem ??= "life-" + Guid.NewGuid().ToString("N")[..16];
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(new
            {
                schemaVersion = "night-watch-identify-v1",
                productCode = "night-watch",
                purpose = "fraud_prevention",
                consentStatus = "granted",
                collectedAt = DateTimeOffset.UtcNow.ToString("O"),
                idempotencyKey = idem,
                tenantId = "ten_life",
                projectId = "prj_web",
                legacyBrowser = new
                {
                    visitorId = hash,
                    sourceManifestRevision = "default-v1",
                    componentKeys = new[] { "canvas", "fonts", "audio", "timezone", "platform" }
                }
            })
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
        var res = await _client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return (json.GetProperty("visitorId").GetString()!, json.GetProperty("eventId").GetString()!, hash);
    }

    [Fact]
    public async Task Deleted_visitor_not_retrievable_via_search_or_alias()
    {
        var (visitorId, eventId, hash) = await IdentifyAsync();

        using var exportOk = new HttpRequestMessage(HttpMethod.Get, $"/v1/visitors/{visitorId}/privacy-export");
        exportOk.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_life");
        exportOk.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        exportOk.Headers.TryAddWithoutValidation("X-Actor-Id", "admin_1");
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(exportOk)).StatusCode);

        using var del = new HttpRequestMessage(HttpMethod.Delete, $"/v1/visitors/{visitorId}?reason=subject_request");
        del.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_life");
        del.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        del.Headers.TryAddWithoutValidation("X-Actor-Id", "admin_1");
        var delRes = await _client.SendAsync(del);
        Assert.Equal(HttpStatusCode.OK, delRes.StatusCode);
        var delBody = await delRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("erased", delBody.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(delBody.GetProperty("visitorIdDigest").GetString()));

        using var search = new HttpRequestMessage(HttpMethod.Get, $"/v1/events?visitorId={visitorId}");
        search.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_life");
        search.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        search.Headers.TryAddWithoutValidation("X-Api-Scope", "events:search");
        search.Headers.TryAddWithoutValidation("X-Actor-Id", "admin_1");
        var searchJson = await (await _client.SendAsync(search)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(searchJson.GetProperty("items").EnumerateArray());

        using var getEv = new HttpRequestMessage(HttpMethod.Get, $"/v1/events/{eventId}");
        getEv.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_life");
        getEv.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        Assert.Equal(HttpStatusCode.Gone, (await _client.SendAsync(getEv)).StatusCode);

        // Alternate alias rematch must not revive erased visitor id.
        var (newVisitor, _, _) = await IdentifyAsync(hash, "life-rematch-" + Guid.NewGuid().ToString("N")[..10]);
        Assert.NotEqual(visitorId, newVisitor);
        Assert.StartsWith("v_", newVisitor);
    }
}
