using NightWatch.Modules.Admin;
using Microsoft.Extensions.Logging.Abstractions;

namespace NightWatch.Api.Tests;

public class ApiCredentialTests
{
    private static ApiCredentialService Create() => new(NullLogger<ApiCredentialService>.Instance);

    [Fact]
    public void Public_key_cannot_query_history()
    {
        var svc = Create();
        var created = svc.Create(
            "ten_cred",
            "env_dev",
            ApiKeyKind.Public,
            scopes: ["collect:ingest"],
            domains: ["example.ir"],
            quotaPerMinute: 100,
            trustedIngestion: false,
            actor: "admin");

        Assert.StartsWith("pk_live_", created.SecretOnce);
        Assert.Equal("***", created.Record.SecretHash);

        var denied = svc.Authorize(created.SecretOnce, "visitors:history", "https://example.ir");
        Assert.False(denied.Allowed);
        Assert.Equal("forbidden", denied.Code);

        var server = svc.Create(
            "ten_cred",
            "env_dev",
            ApiKeyKind.Server,
            scopes: ["visitors:history", "events:search"],
            domains: ["example.ir"],
            quotaPerMinute: 100,
            trustedIngestion: true,
            actor: "admin");

        var ok = svc.Authorize(server.SecretOnce, "visitors:history", "https://example.ir");
        Assert.True(ok.Allowed);
    }

    [Fact]
    public void Revoked_key_fails_immediately()
    {
        var svc = Create();
        var created = svc.Create(
            "ten_cred2",
            "env_dev",
            ApiKeyKind.Server,
            scopes: ["events:search"],
            domains: [],
            quotaPerMinute: 50,
            trustedIngestion: true,
            actor: "admin");

        Assert.True(svc.Authorize(created.SecretOnce, "events:search").Allowed);
        Assert.True(svc.Revoke(created.Record.TenantId, created.Record.KeyId, "admin"));
        var after = svc.Authorize(created.SecretOnce, "events:search");
        Assert.False(after.Allowed);
        Assert.Equal("key_revoked", after.Code);
    }
}
