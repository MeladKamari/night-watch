using NightWatch.BuildingBlocks.Gateway;

namespace NightWatch.Api.Tests;

public class GatewayConfigTests
{
    [Fact]
    public void Offline_gateway_artifacts_pass_smoke_validation()
    {
        var root = FindRepoRoot();
        var nginx = File.ReadAllText(Path.Combine(root, "deploy", "gateway", "nginx-first-party.conf"));
        var hosts = File.ReadAllText(Path.Combine(root, "deploy", "gateway", "hosts.offline.example"));
        var pki = File.ReadAllText(Path.Combine(root, "deploy", "gateway", "PRIVATE_PKI.md"));

        var (ok, errors) = GatewayConfigValidator.ValidateNginxConfig(nginx);
        Assert.True(ok, string.Join(",", errors));
        Assert.True(GatewayConfigValidator.HasOfflineHosts(hosts));
        Assert.Contains("Private PKI", pki, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ca.crt", pki, StringComparison.Ordinal);
        Assert.DoesNotContain("fingerprint.com", nginx, StringComparison.OrdinalIgnoreCase);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "deploy", "gateway", "nginx-first-party.conf")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("repo root with deploy/gateway not found");
    }
}
