using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class ObservationIngestTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ObservationIngestTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private static object ValidBody(string? nonce = "nonce-abcdef01", string idem = "idempotency-key-001") => new
    {
        schemaVersion = "night-watch-observation-v1",
        productCode = "night-watch",
        processingVersion = "night-watch-processing-v4",
        identityAlgorithmVersion = "night-watch-identity-v4",
        purpose = "fraud_prevention",
        consentStatus = "granted",
        collectedAt = DateTimeOffset.UtcNow.ToString("O"),
        idempotencyKey = idem,
        nonce,
        region = "ir-central",
        clientIp = "1.2.3.4",
        clientRiskScore = 0.99,
        clientConfidence = 0.99,
        clientVisitorId = "should_be_ignored_as_authority",
        legacyBrowser = new
        {
            visitorId = "c5e055512be85b8798fe5d3240b2a04e",
            sourceManifestRevision = "default-v1",
            hashingRevision = "murmur3-x64-128-canonical-v1",
            confidenceScore = 0.6,
            componentKeys = new[] { "platform", "timezone" },
            sdkPackageVersion = "0.1.0-rc.1"
        }
    };

    private HttpRequestMessage Post(object body, string? origin = "https://example.ir", string? idemHeader = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/observations")
        {
            Content = JsonContent.Create(body)
        };
        if (origin is not null)
        {
            req.Headers.TryAddWithoutValidation("Origin", origin);
        }

        if (idemHeader is not null)
        {
            req.Headers.TryAddWithoutValidation("Idempotency-Key", idemHeader);
        }

        return req;
    }

    [Fact]
    public async Task Accepts_valid_observation_with_202()
    {
        using var req = Post(ValidBody(nonce: "nonce-unique-ok1"), idemHeader: "idem-header-ok-0001");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Accepted, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("accepted", json.GetProperty("status").GetString());
        Assert.StartsWith("ev_", json.GetProperty("eventId").GetString());
        Assert.False(json.GetProperty("duplicate").GetBoolean());
    }

    [Fact]
    public async Task Idempotency_returns_same_event_without_double_accept()
    {
        var body = ValidBody(nonce: null, idem: "idem-dup-shared-0001");
        using var r1 = Post(body, idemHeader: "idem-dup-shared-0001");
        using var r2 = Post(body, idemHeader: "idem-dup-shared-0001");
        var a = await _client.SendAsync(r1);
        var b = await _client.SendAsync(r2);
        Assert.Equal(HttpStatusCode.Accepted, a.StatusCode);
        Assert.Equal(HttpStatusCode.OK, b.StatusCode);
        var ja = await a.Content.ReadFromJsonAsync<JsonElement>();
        var jb = await b.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ja.GetProperty("eventId").GetString(), jb.GetProperty("eventId").GetString());
        Assert.True(jb.GetProperty("duplicate").GetBoolean());
    }

    [Fact]
    public async Task Rejects_cross_origin_and_oversize_and_replay_and_applePay()
    {
        using var badOrigin = Post(ValidBody(nonce: "n-origin-1"), origin: "https://evil.example");
        var originRes = await _client.SendAsync(badOrigin);
        Assert.Equal(HttpStatusCode.Forbidden, originRes.StatusCode);
        Assert.Equal("application/problem+json", originRes.Content.Headers.ContentType?.MediaType);

        var huge = new string('x', 70_000);
        using var oversize = new HttpRequestMessage(HttpMethod.Post, "/v1/observations")
        {
            Content = new StringContent($"{{\"pad\":\"{huge}\"}}", Encoding.UTF8, "application/json")
        };
        oversize.Headers.TryAddWithoutValidation("Origin", "https://example.ir");
        // Content-Length is set by StringContent; service checks ContentLength
        var overRes = await _client.SendAsync(oversize);
        Assert.True(
            overRes.StatusCode is HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.BadRequest,
            overRes.StatusCode.ToString());

        using var first = Post(ValidBody(nonce: "replay-nonce-001", idem: "idem-replay-a-0001"), idemHeader: "idem-replay-a-0001");
        using var second = Post(ValidBody(nonce: "replay-nonce-001", idem: "idem-replay-b-0001"), idemHeader: "idem-replay-b-0001");
        Assert.Equal(HttpStatusCode.Accepted, (await _client.SendAsync(first)).StatusCode);
        var replay = await _client.SendAsync(second);
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);

        var apple = ValidBody(nonce: "n-apple-1", idem: "idem-apple-00000001");
        // rebuild with applePay key via dictionary
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(apple))!;
        var legacy = JsonSerializer.Deserialize<Dictionary<string, object>>(dict["legacyBrowser"].GetRawText())!;
        legacy["componentKeys"] = new[] { "platform", "applePay" };
        dict["legacyBrowser"] = JsonSerializer.SerializeToElement(legacy);
        using var appleReq = Post(dict, idemHeader: "idem-apple-00000001");
        var appleRes = await _client.SendAsync(appleReq);
        Assert.Equal(HttpStatusCode.BadRequest, appleRes.StatusCode);
        var problem = await appleRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("apple_pay_forbidden", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Fuzz_malformed_json_and_wrong_content_type()
    {
        using var malformed = new HttpRequestMessage(HttpMethod.Post, "/v1/observations")
        {
            Content = new StringContent("{not-json", Encoding.UTF8, "application/json")
        };
        malformed.Headers.TryAddWithoutValidation("Origin", "https://example.ir");
        var badJson = await _client.SendAsync(malformed);
        Assert.Equal(HttpStatusCode.BadRequest, badJson.StatusCode);

        using var wrongCt = new HttpRequestMessage(HttpMethod.Post, "/v1/observations")
        {
            Content = new StringContent("{}", Encoding.UTF8, "text/plain")
        };
        wrongCt.Headers.TryAddWithoutValidation("Origin", "https://example.ir");
        var ctRes = await _client.SendAsync(wrongCt);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, ctRes.StatusCode);
    }
}
