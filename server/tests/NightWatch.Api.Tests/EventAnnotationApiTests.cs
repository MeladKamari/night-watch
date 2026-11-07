using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NightWatch.Modules.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Api.Tests;

public class EventAnnotationApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public EventAnnotationApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string> IdentifyEventAsync()
    {
        var idem = "annot-idem-" + Guid.NewGuid().ToString("N")[..12];
        var (res, json) = await IdentifyFixtures.PostIdentifyAsync(
            _client,
            "annot-" + Guid.NewGuid().ToString("N")[..12],
            idem,
            tenant: "ten_annot",
            project: "prj_web");
        res.EnsureSuccessStatusCode();
        return json.GetProperty("eventId").GetString()!;
    }

    [Fact]
    public async Task Concurrent_patch_uses_revision_and_keeps_audit()
    {
        var eventId = await IdentifyEventAsync();

        using var p1 = new HttpRequestMessage(HttpMethod.Patch, $"/v1/events/{eventId}")
        {
            Content = JsonContent.Create(new
            {
                linkedId = "biz_order_1",
                heuristicSuspect = "yes",
                tags = new[] { "manual_review" },
                reason = "velocity",
                ifMatchRevision = 1
            })
        };
        p1.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_annot");
        p1.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        p1.Headers.TryAddWithoutValidation("X-Actor-Id", "op_a");
        p1.Headers.TryAddWithoutValidation("If-Match", "\"1\"");

        var r1 = await _client.SendAsync(p1);
        Assert.Equal(HttpStatusCode.OK, r1.StatusCode);
        var s1 = await r1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, s1.GetProperty("revision").GetInt64());
        Assert.Equal("yes", s1.GetProperty("heuristicSuspect").GetString());
        Assert.Equal("none", s1.GetProperty("adjudicatedLabel").GetString());

        // Stale revision must conflict.
        using var stale = new HttpRequestMessage(HttpMethod.Patch, $"/v1/events/{eventId}")
        {
            Content = JsonContent.Create(new { tags = new[] { "stale" }, ifMatchRevision = 1 })
        };
        stale.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_annot");
        stale.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        stale.Headers.TryAddWithoutValidation("X-Actor-Id", "op_b");
        var conflict = await _client.SendAsync(stale);
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);

        using var fb = new HttpRequestMessage(HttpMethod.Post, $"/v1/events/{eventId}/feedback")
        {
            Content = JsonContent.Create(new
            {
                label = "fraud",
                reason = "chargeback",
                evidenceRef = "case:CB-9",
                ifMatchRevision = 2
            })
        };
        fb.Headers.TryAddWithoutValidation("X-Tenant-Id", "ten_annot");
        fb.Headers.TryAddWithoutValidation("X-Api-Key-Kind", "server");
        fb.Headers.TryAddWithoutValidation("X-Actor-Id", "op_a");
        var fbRes = await _client.SendAsync(fb);
        Assert.Equal(HttpStatusCode.OK, fbRes.StatusCode);
        var s2 = await fbRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("fraud", s2.GetProperty("adjudicatedLabel").GetString());
        Assert.Equal("yes", s2.GetProperty("heuristicSuspect").GetString()); // heuristic unchanged

        using var scope = _factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IEventAnnotationService>();
        var audit = svc.GetAudit(eventId, "ten_annot");
        Assert.Equal(2, audit.Count);
        Assert.Equal("patch", audit[0].Action);
        Assert.Equal("feedback", audit[1].Action);
        Assert.Equal(1, audit[0].RevisionBefore);
        Assert.Equal(2, audit[0].RevisionAfter);
        Assert.Equal("case:CB-9", audit[1].EvidenceRef);
    }
}
