using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NightWatch.Modules.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Api.Tests;

public class EventSearchApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public EventSearchApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task IdentifyAsync(string hash, string idem, string tenant)
    {
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
                tenantId = tenant,
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
        (await _client.SendAsync(req)).EnsureSuccessStatusCode();
    }

    private static HttpRequestMessage Search(string tenant, string? scope = "events:search", string query = "")
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/v1/events" + query);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenant);
        req.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        if (scope is not null)
        {
            req.Headers.TryAddWithoutValidation("X-Api-Scope", scope);
        }

        req.Headers.TryAddWithoutValidation("X-Actor-Id", "tester");
        return req;
    }

    [Fact]
    public async Task Filtered_results_never_cross_tenant()
    {
        await IdentifyAsync("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa11", "search-t1-00000001", "ten_search_a");
        await IdentifyAsync("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb11", "search-t2-00000001", "ten_search_b");

        using var req = Search("ten_search_a", query: "?signalStatus=pending&limit=50");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        var items = json.GetProperty("items").EnumerateArray().ToList();
        Assert.NotEmpty(items);
        // All hits must belong to tenant A catalog only — verified via visitor rematch isolation:
        // tenant B event must not appear when filtering A (we check by re-querying B separately).
        using var reqB = Search("ten_search_b", query: "?limit=50");
        var jsonB = await (await _client.SendAsync(reqB)).Content.ReadFromJsonAsync<JsonElement>();
        var idsA = items.Select(i => i.GetProperty("eventId").GetString()).ToHashSet();
        var idsB = jsonB.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("eventId").GetString()).ToHashSet();
        Assert.Empty(idsA.Intersect(idsB));
        Assert.Equal("unavailable", items[0].GetProperty("networkAsnStatus").GetString());
        Assert.True(json.GetProperty("audited").GetInt32() > 0);
        Assert.False(string.IsNullOrWhiteSpace(json.GetProperty("plannerHint").GetString()));
    }

    [Fact]
    public async Task Planner_hint_for_large_datasets_and_scope_denial()
    {
        using var noScope = Search("ten_big", scope: "events:read", query: "?limit=1");
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(noScope)).StatusCode);

        // Force large-dataset planner path via options threshold override on catalog seed size.
        using (var scope = _factory.Services.CreateScope())
        {
            var opts = scope.ServiceProvider.GetRequiredService<EventSearchOptions>();
            opts.LargeDatasetThreshold = 2;
            var catalog = scope.ServiceProvider.GetRequiredService<IIdentificationEventCatalog>();
            for (var i = 0; i < 3; i++)
            {
                catalog.Upsert(new CatalogEventRecord
                {
                    EventId = $"ev_searchbig{i:00000000}",
                    VisitorId = "v_searchbig",
                    TenantId = "ten_big",
                    ProjectId = "prj",
                    Purpose = "fraud_prevention",
                    MatchType = "created",
                    EventStatus = "created",
                    SignalStatus = "pending",
                    RiskStatus = "unavailable",
                    ProcessingRevision = "night-watch-processing-v0",
                    IdentityAlgorithmVersion = "night-watch-identity-v0",
                    CreatedAt = DateTimeOffset.UtcNow,
                    SuspectStatus = "unknown",
                    RiskBand = "unavailable",
                    Source = "browser_sdk"
                });
            }
        }

        using var req = Search("ten_big", query: "?limit=2");
        var json = await (await _client.SendAsync(req)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("prefer_narrow_filters_indexed_sequence", json.GetProperty("plannerHint").GetString());
    }
}
