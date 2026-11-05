using System.Net;
using System.Text.Json;
using NightWatch.BuildingBlocks;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Live_returns_ok_without_secrets()
    {
        var response = await _client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("live", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ConnectionString", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("fingerprint.com", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Ready_distinguishes_readiness_and_omits_secrets()
    {
        var response = await _client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("status", out _));
        Assert.True(doc.RootElement.TryGetProperty("checks", out _));
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("User ID=", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Meta_lists_eight_modules_and_excludes_apple_pay()
    {
        var response = await _client.GetAsync("/v1/meta");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(ProductIdentity.ProductCode, doc.RootElement.GetProperty("productCode").GetString());
        Assert.False(doc.RootElement.GetProperty("runtimeVendorSaas").GetBoolean());
        Assert.Equal("excluded", doc.RootElement.GetProperty("applePay").GetString());
        var modules = doc.RootElement.GetProperty("modules").EnumerateArray().Select(e => e.GetString()).ToArray();
        Assert.Equal(ModuleNames.All.Count, modules.Length);
        foreach (var name in ModuleNames.All)
        {
            Assert.Contains(name, modules);
        }
    }

    [Fact]
    public void Forbidden_vendor_hosts_are_detected()
    {
        Assert.True(ProductIdentity.IsForbiddenHost("api.fingerprint.com"));
        Assert.True(ProductIdentity.IsForbiddenHost("m1.openfpcdn.io"));
        Assert.False(ProductIdentity.IsForbiddenHost("fp.example.ir"));
    }
}
