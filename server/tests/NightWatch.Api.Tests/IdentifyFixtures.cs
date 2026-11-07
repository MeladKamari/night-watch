using System.Net.Http.Json;
using System.Text.Json;
using NightWatch.BuildingBlocks;
using NightWatch.BuildingBlocks.Hashing;

namespace NightWatch.Api.Tests;

/// <summary>Builds identify payloads with real components + server-matching visitorId hash + challenge.</summary>
internal static class IdentifyFixtures
{
    public static (string VisitorId, Dictionary<string, object> Components, string[] Keys) Fingerprint(string salt)
    {
        var components = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["platform"] = new { value = salt, duration = 1 },
            ["timezone"] = new { value = "Asia/Tehran", duration = 1 },
            ["canvas"] = new { value = $"c-{salt}", duration = 1 },
            ["fonts"] = new { value = new[] { "Arial", salt }, duration = 1 },
            ["audio"] = new { value = salt.Length, duration = 1 },
        };

        var json = JsonSerializer.Serialize(components);
        using var doc = JsonDocument.Parse(json);
        var hash = ComponentHasher.HashComponents(doc.RootElement);
        var keys = components.Keys.OrderBy(k => k, StringComparer.Ordinal).ToArray();
        return (hash, components, keys);
    }

    public static async Task<string> IssueChallengeAsync(HttpClient client, string tenantId, string projectId)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify/challenge")
        {
            Content = JsonContent.Create(new { tenantId, projectId })
        };
        var res = await client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("challengeNonce").GetString()!;
    }

    public static object Body(
        string salt,
        string idem,
        string tenant = "ten_a",
        string project = "prj_web",
        string? challengeNonce = null,
        string? continuityToken = null,
        object? clientDevice = null,
        object? environmentProbes = null,
        string? continuityLegalBasis = "legitimate_interest")
    {
        var (visitorId, components, keys) = Fingerprint(salt);
        return new
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
            challengeNonce,
            clientVisitorId = "ignored_client_authority",
            clientConfidence = 0.99,
            clientDevice,
            environmentProbes,
            continuityToken,
            continuityLegalBasis,
            legacyBrowser = new
            {
                visitorId,
                sourceManifestRevision = ProductIdentity.LegacySourceManifestRevision,
                hashingRevision = ProductIdentity.HashingRevision,
                componentKeys = keys,
                components
            }
        };
    }

    public static object BodyFromFingerprint(
        string visitorId,
        Dictionary<string, object> components,
        string[] keys,
        string idem,
        string tenant,
        string project,
        string challengeNonce,
        object? clientDevice = null,
        object? environmentProbes = null,
        string? continuityToken = null)
    {
        return new
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
            challengeNonce,
            clientDevice,
            environmentProbes,
            continuityToken,
            continuityLegalBasis = "legitimate_interest",
            legacyBrowser = new
            {
                visitorId,
                sourceManifestRevision = ProductIdentity.LegacySourceManifestRevision,
                hashingRevision = ProductIdentity.HashingRevision,
                componentKeys = keys,
                components
            }
        };
    }

    public static async Task<(HttpResponseMessage Response, JsonElement Json)> PostIdentifyAsync(
        HttpClient client,
        string salt,
        string idem,
        string tenant = "ten_a",
        string project = "prj_web",
        object? clientDevice = null,
        object? environmentProbes = null,
        string? continuityToken = null)
    {
        var nonce = await IssueChallengeAsync(client, tenant, project);
        var body = Body(
            salt,
            idem,
            tenant,
            project,
            nonce,
            continuityToken,
            clientDevice,
            environmentProbes);
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/identify")
        {
            Content = JsonContent.Create(body)
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
        var res = await client.SendAsync(req);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return (res, json);
    }
}
