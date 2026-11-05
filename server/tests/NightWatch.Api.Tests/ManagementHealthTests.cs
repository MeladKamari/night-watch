using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NightWatch.Api.Tests;

public class ManagementHealthTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ManagementHealthTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Management_health_and_meta_are_reachable()
    {
        var client = _factory.CreateClient();
        var health = await client.GetFromJsonAsync<Dictionary<string, object>>("/v1/management/health");
        Assert.NotNull(health);
        Assert.Equal("known", health!["apiStatus"]?.ToString() ?? health["apiStatus"]?.ToString());

        var meta = await client.GetFromJsonAsync<Dictionary<string, object>>("/v1/meta");
        Assert.NotNull(meta);
        Assert.Equal("excluded", meta!["applePay"]?.ToString());
    }
}
