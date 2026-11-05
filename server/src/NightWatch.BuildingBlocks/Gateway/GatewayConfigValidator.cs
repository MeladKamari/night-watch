using System.Text.RegularExpressions;

namespace NightWatch.BuildingBlocks.Gateway;

public static class GatewayConfigValidator
{
    private static readonly string[] ForbiddenFragments =
    [
        "fingerprint.com", "fpjs.io", "openfpcdn", "google-analytics", "googletagmanager"
    ];

    public static (bool Ok, string[] Errors) ValidateNginxConfig(string configText)
    {
        var errors = new List<string>();
        if (!configText.Contains("client_max_body_size", StringComparison.Ordinal))
        {
            errors.Add("missing_body_limit");
        }

        if (!configText.Contains("Content-Security-Policy", StringComparison.Ordinal))
        {
            errors.Add("missing_csp");
        }

        if (!configText.Contains("ssl_certificate", StringComparison.Ordinal))
        {
            errors.Add("missing_tls");
        }

        if (!configText.Contains("/collect", StringComparison.Ordinal) || !configText.Contains("/identify", StringComparison.Ordinal))
        {
            errors.Add("missing_first_party_paths");
        }

        foreach (var f in ForbiddenFragments)
        {
            if (configText.Contains(f, StringComparison.OrdinalIgnoreCase))
            {
                errors.Add("forbidden_foreign_host:" + f);
            }
        }

        if (!Regex.IsMatch(configText, @"X-Forwarded-For\s+\$remote_addr"))
        {
            errors.Add("proxy_header_must_use_remote_addr_not_client_xff");
        }

        return (errors.Count == 0, errors.ToArray());
    }

    public static bool HasOfflineHosts(string hostsFile) =>
        hostsFile.Contains("identify.local.test", StringComparison.Ordinal)
        && hostsFile.Contains("127.0.0.1", StringComparison.Ordinal);
}
