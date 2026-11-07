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

    [Fact]
    public async Task Same_request_is_idempotent()
    {
        const string salt = "idem-salt-aaaaaaaa";
        const string idem = "identify-idem-00000001";
        var fp = IdentifyFixtures.Fingerprint(salt);
        var nonce = await IdentifyFixtures.IssueChallengeAsync(_client, "ten_a", "prj_web");
        var body = IdentifyFixtures.BodyFromFingerprint(
            fp.VisitorId, fp.Components, fp.Keys, idem, "ten_a", "prj_web", nonce);

        using var r1 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        r1.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
        using var r2 = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        r2.Headers.TryAddWithoutValidation("Idempotency-Key", idem);

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
        Assert.True(ja.TryGetProperty("velocity", out var vel));
        Assert.True(vel.GetProperty("eventsLastHour").GetInt32() >= 1);
    }

    [Fact]
    public async Task Similar_browsers_are_not_auto_merged()
    {
        var (a, ja) = await IdentifyFixtures.PostIdentifyAsync(_client, "user1-bbbbbbbb", "identify-user1-0000001");
        var (b, jb) = await IdentifyFixtures.PostIdentifyAsync(_client, "user2-cccccccc", "identify-user2-0000001");
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        Assert.NotEqual(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("created", jb.GetProperty("matchType").GetString());
    }

    [Fact]
    public async Task Exact_alias_rematch_returns_matched()
    {
        const string salt = "rematch-dddddddd";
        var (a, ja) = await IdentifyFixtures.PostIdentifyAsync(_client, salt, "identify-rematch-00001");
        var (b, jb) = await IdentifyFixtures.PostIdentifyAsync(_client, salt, "identify-rematch-00002");
        Assert.Equal(HttpStatusCode.OK, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        Assert.Equal(ja.GetProperty("visitorId").GetString(), jb.GetProperty("visitorId").GetString());
        Assert.Equal("created", ja.GetProperty("matchType").GetString());
        Assert.Equal("matched", jb.GetProperty("matchType").GetString());
        Assert.NotEqual(ja.GetProperty("eventId").GetString(), jb.GetProperty("eventId").GetString());
    }

    [Fact]
    public async Task Rejects_random_hex_without_matching_components()
    {
        var nonce = await IdentifyFixtures.IssueChallengeAsync(_client, "ten_a", "prj_web");
        var body = new
        {
            schemaVersion = "night-watch-identify-v1",
            productCode = "night-watch",
            purpose = "fraud_prevention",
            consentStatus = "granted",
            collectedAt = DateTimeOffset.UtcNow.ToString("O"),
            idempotencyKey = "identify-fake-hex-00001",
            tenantId = "ten_a",
            projectId = "prj_web",
            challengeNonce = nonce,
            legacyBrowser = new
            {
                visitorId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                sourceManifestRevision = "default-v1",
                hashingRevision = "murmur3-x64-128-canonical-v1",
                componentKeys = new[] { "platform", "timezone" },
                components = new Dictionary<string, object>
                {
                    ["platform"] = new { value = "Win32", duration = 1 },
                    ["timezone"] = new { value = "UTC", duration = 1 }
                }
            }
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", "identify-fake-hex-00001");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var problem = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("visitor_hash_mismatch", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Rejects_missing_challenge_and_replay()
    {
        var fp = IdentifyFixtures.Fingerprint("chal-replay-salt");
        var bodyNoChal = IdentifyFixtures.BodyFromFingerprint(
            fp.VisitorId, fp.Components, fp.Keys, "identify-nochal-00001", "ten_a", "prj_web", challengeNonce: "");
        using var noChal = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(bodyNoChal)
        };
        noChal.Headers.TryAddWithoutValidation("Idempotency-Key", "identify-nochal-00001");
        var missing = await _client.SendAsync(noChal);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        var nonce = await IdentifyFixtures.IssueChallengeAsync(_client, "ten_a", "prj_web");
        var body1 = IdentifyFixtures.BodyFromFingerprint(
            fp.VisitorId, fp.Components, fp.Keys, "identify-chal-ok-0001", "ten_a", "prj_web", nonce);
        using var okReq = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body1)
        };
        okReq.Headers.TryAddWithoutValidation("Idempotency-Key", "identify-chal-ok-0001");
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(okReq)).StatusCode);

        var bodyReplay = IdentifyFixtures.BodyFromFingerprint(
            fp.VisitorId, fp.Components, fp.Keys, "identify-chal-replay-1", "ten_a", "prj_web", nonce);
        using var replayReq = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(bodyReplay)
        };
        replayReq.Headers.TryAddWithoutValidation("Idempotency-Key", "identify-chal-replay-1");
        var replay = await _client.SendAsync(replayReq);
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
        var problem = await replay.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("challenge_invalid", problem.GetProperty("code").GetString());
    }
}
