using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using NightWatch.Modules.Admin;
using NightWatch.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Api.Tests;

public class ConsoleAuthAndManagementTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ConsoleAuthAndManagementTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Login_csrf_required_for_key_create_and_cases_list()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

        var bad = await client.PostAsync("/v1/console/login",
            new StringContent("""{"username":"admin","password":"wrong"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);

        var loginRes = await client.PostAsync("/v1/console/login",
            new StringContent("""{"username":"admin","password":"admin-change-me"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
        var login = await loginRes.Content.ReadFromJsonAsync<ConsoleLoginResponse>();
        Assert.NotNull(login);
        Assert.False(string.IsNullOrWhiteSpace(login!.SessionId));
        Assert.True(login.CsrfToken.Length >= 16);

        client.DefaultRequestHeaders.Remove("Authorization");
        client.DefaultRequestHeaders.Add("Authorization", "Bearer " + login.SessionId);
        client.DefaultRequestHeaders.Remove("X-Console-Session");
        client.DefaultRequestHeaders.Add("X-Console-Session", login.SessionId);

        var noCsrf = await client.PostAsync("/v1/management/keys",
            new StringContent("""{"kind":"Public","environmentId":"dev","scopes":["collect:ingest"]}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Forbidden, noCsrf.StatusCode);

        client.DefaultRequestHeaders.Remove(ConsoleAuthService.CsrfHeaderName);
        client.DefaultRequestHeaders.Add(ConsoleAuthService.CsrfHeaderName, login.CsrfToken);
        var created = await client.PostAsync("/v1/management/keys",
            new StringContent("""{"kind":"Public","environmentId":"dev","scopes":["collect:ingest"]}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var keys = await client.GetFromJsonAsync<JsonElement>("/v1/management/keys?environmentId=dev");
        Assert.True(keys.GetProperty("items").GetArrayLength() >= 1);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            Assert.True(db.ManagementApiKeys.Any(), "API keys should dual-write to EF management_api_keys");
        }

        var openCase = await client.PostAsync("/v1/management/cases",
            new StringContent("""{"highRisk":false,"evidence":["t"]}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, openCase.StatusCode);

        var cases = await client.GetFromJsonAsync<JsonElement>("/v1/management/cases");
        Assert.True(cases.GetProperty("items").GetArrayLength() >= 1);

        var rules = await client.GetFromJsonAsync<JsonElement>("/v1/management/rules");
        Assert.Equal("none", rules.GetProperty("revision").GetString());

        var sim = await client.PostAsync("/v1/management/rules/simulate",
            new StringContent("""{"facts":{"suspect_score":10}}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, sim.StatusCode);

        var createdBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var keyId = createdBody.GetProperty("keyId").GetString();
        Assert.False(string.IsNullOrWhiteSpace(keyId));

        var revoked = await client.PostAsync($"/v1/management/keys/{keyId}/revoke",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, revoked.StatusCode);

        var published = await client.PostAsync("/v1/management/rules",
            new StringContent(
                """{"revision":"rev_test","rules":[{"ruleId":"r1","priority":10,"action":"Challenge","when":{"field":"suspect_score","op":"Gte","value":70}}]}""",
                Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, published.StatusCode);

        var wh = await client.PostAsync("/v1/management/webhooks",
            new StringContent(
                """{"environmentId":"dev","targetUrl":"http://127.0.0.1:9999/hook","eventFilters":["event.identification"]}""",
                Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, wh.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            Assert.True(db.ManagementWebhookSubscriptions.Any(), "webhooks should dual-write to EF");
        }

        var hooks = await client.GetFromJsonAsync<JsonElement>("/v1/management/webhooks?environmentId=dev");
        Assert.True(hooks.GetProperty("items").GetArrayLength() >= 1);

        var project = await client.PostAsync("/v1/management/projects",
            new StringContent("""{"name":"lab"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, project.StatusCode);

        var audit = await client.GetFromJsonAsync<JsonElement>("/v1/management/audit");
        Assert.True(audit.GetProperty("items").GetArrayLength() >= 1);

        var usage = await client.GetFromJsonAsync<JsonElement>("/v1/management/usage?projectId=default&environmentId=dev");
        Assert.Equal("events", usage.GetProperty("unit").GetString());

        var edge = await client.PostAsync("/v1/management/graph/edges",
            new StringContent("""{"from":"device_a","to":"acc_1","confidence":0.8}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, edge.StatusCode);

        var graph = await client.GetFromJsonAsync<JsonElement>("/v1/management/graph");
        Assert.True(graph.GetProperty("edges").GetArrayLength() >= 1);
        Assert.Equal(180, graph.GetProperty("halfLifeDays").GetInt32());

        var explain = await client.PostAsync("/v1/management/score/explain",
            new StringContent("""{"headlessHints":true,"webDriver":true,"browserAutomationHints":true,"userAgent":"BrowserUse"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, explain.StatusCode);
        var explained = await explain.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(explained.GetProperty("score").GetInt32() > 0);
        Assert.True(explained.GetProperty("facets").TryGetProperty("humanity", out _));
        Assert.Contains(explained.GetProperty("contributions").EnumerateArray(),
            c => c.GetProperty("signalId").GetString() == "browser_automation_agent_detection");

        var tombs = await client.GetAsync("/v1/management/privacy/tombstones");
        Assert.Equal(HttpStatusCode.OK, tombs.StatusCode);

        var bot = await client.GetFromJsonAsync<JsonElement>("/v1/management/bots/verify?userAgent=Googlebot");
        Assert.Equal("SpoofedUserAgent", bot.GetProperty("classification").GetString());

        var velEnable = await client.PostAsync("/v1/management/velocity/enable",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, velEnable.StatusCode);
        var velRecord = await client.PostAsync("/v1/management/velocity/record",
            new StringContent("""{"accountHash":"acc_demo","type":"LoginFailure"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, velRecord.StatusCode);
        var velocity = await client.GetFromJsonAsync<JsonElement>("/v1/management/velocity?accountHash=acc_demo");
        Assert.True(velocity.GetProperty("enabled").GetBoolean());
        Assert.True(velocity.GetProperty("loginFailures").GetInt32() >= 1);

        var catalog = await client.GetFromJsonAsync<JsonElement>("/v1/management/signals/catalog");
        Assert.True(catalog.GetProperty("items").GetArrayLength() >= 20);

        var evalSignals = await client.PostAsync("/v1/management/signals/evaluate",
            new StringContent("""{"headlessHints":true,"webDriver":true}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, evalSignals.StatusCode);

        var whBody = await wh.Content.ReadFromJsonAsync<JsonElement>();
        var subId = whBody.GetProperty("subscriptionId").GetString();
        var enq = await client.PostAsync($"/v1/management/webhooks/{subId}/enqueue",
            new StringContent("""{"eventType":"event.identification"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, enq.StatusCode);
        var processed = await client.PostAsync("/v1/management/webhooks/process",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, processed.StatusCode);
        var procBody = await processed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(procBody.GetProperty("processed").GetInt32() >= 1);
    }
}
