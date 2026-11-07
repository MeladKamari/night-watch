using System.Net.Http.Json;
using System.Text.Json;
using Grpc.Net.Client;
using Microsoft.AspNetCore.Mvc.Testing;
using NightWatch.Api.Grpc.V1;
using NightWatch.BuildingBlocks;

namespace NightWatch.Api.Tests;

public class GrpcIdentityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public GrpcIdentityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private NightWatchIdentity.NightWatchIdentityClient CreateClient()
    {
        var handler = _factory.Server.CreateHandler();
        var channel = GrpcChannel.ForAddress("http://localhost", new GrpcChannelOptions
        {
            HttpHandler = handler
        });
        return new NightWatchIdentity.NightWatchIdentityClient(channel);
    }

    [Fact]
    public async Task Health_and_meta_over_grpc()
    {
        var client = CreateClient();
        var health = await client.HealthAsync(new HealthRequest());
        Assert.Equal("live", health.Status);
        Assert.Equal(ProductIdentity.ProductCode, health.Product);

        var meta = await client.GetMetaAsync(new MetaRequest());
        Assert.Equal(ProductIdentity.IdentityAlgorithmVersion, meta.IdentityAlgorithmVersion);
        Assert.Contains("grpc", meta.Transports);
        Assert.Contains("http", meta.Transports);
    }

    [Fact]
    public async Task Challenge_identify_unseal_roundtrip()
    {
        var client = CreateClient();
        const string tenant = "ten_grpc";
        const string project = "prj_grpc";

        var chal = await client.ChallengeAsync(new ChallengeRequest
        {
            TenantId = tenant,
            ProjectId = project
        });
        Assert.False(string.IsNullOrWhiteSpace(chal.ChallengeNonce));

        var fp = IdentifyFixtures.Fingerprint("grpc-salt-" + Guid.NewGuid().ToString("N")[..8]);
        var componentsJson = JsonSerializer.Serialize(fp.Components);

        var req = new IdentifyRequest
        {
            SchemaVersion = "night-watch-identify-v1",
            ProductCode = ProductIdentity.ProductCode,
            Purpose = "fraud_prevention",
            ConsentStatus = "granted",
            CollectedAt = DateTimeOffset.UtcNow.ToString("O"),
            IdempotencyKey = "grpc-idem-" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenant,
            ProjectId = project,
            ChallengeNonce = chal.ChallengeNonce,
            SealAudience = "hermes-backend",
            LegacyBrowser = new LegacyBrowser
            {
                VisitorId = fp.VisitorId,
                SourceManifestRevision = ProductIdentity.LegacySourceManifestRevision,
                HashingRevision = ProductIdentity.HashingRevision,
                ComponentsJson = componentsJson
            }
        };
        req.LegacyBrowser.ComponentKeys.AddRange(fp.Keys);

        var id = await client.IdentifyAsync(req);
        Assert.StartsWith("v_", id.VisitorId);
        Assert.Equal("created", id.MatchType);
        Assert.False(string.IsNullOrWhiteSpace(id.SealedEnvelope));
        Assert.Equal("hermes-backend", id.SealedAudience);
        Assert.NotNull(id.Velocity);

        var unseal = await client.UnsealAsync(new UnsealRequest
        {
            Envelope = id.SealedEnvelope,
            Audience = "hermes-backend"
        });
        Assert.True(unseal.Ok);
        Assert.Equal(id.EventId, unseal.EventId);
        Assert.Contains(id.VisitorId, unseal.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task HashComponents_matches_http_lab_helper()
    {
        var client = CreateClient();
        var grpc = await client.HashComponentsAsync(new HashComponentsRequest
        {
            ComponentsJson = """{"a":{"value":"x","duration":1},"b":{"value":1,"duration":1}}"""
        });
        Assert.Equal("b0a3ed33df2bfd9f8ead1eebe9d2cf99", grpc.VisitorId);

        using var http = _factory.CreateClient();
        using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/lab/hash-components")
        {
            Content = JsonContent.Create(new
            {
                components = new Dictionary<string, object>
                {
                    ["a"] = new { value = "x", duration = 1 },
                    ["b"] = new { value = 1, duration = 1 }
                }
            })
        };
        var res = await http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(grpc.VisitorId, json.GetProperty("visitorId").GetString());
    }
}
