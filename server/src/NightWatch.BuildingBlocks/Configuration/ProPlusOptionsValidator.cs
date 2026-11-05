using Microsoft.Extensions.Options;

namespace NightWatch.BuildingBlocks.Configuration;

public sealed class ProPlusOptionsValidator : IValidateOptions<ProPlusOptions>
{
    private static readonly string[] DangerousCredentialPatterns =
    [
        "password=postgres",
        "password=password",
        "password=admin",
        "password=changeme",
        "password=123456",
        "password=;",
        "pwd=postgres",
        "postgres:postgres@",
        "user=sa;password=",
        "admin:admin@"
    ];

    public ValidateOptionsResult Validate(string? name, ProPlusOptions options)
    {
        var errors = new List<string>();

        if (options.SdkVersions.LegacySourceManifestRevision != ProductIdentity.LegacySourceManifestRevision)
        {
            errors.Add(
                $"SdkVersions.LegacySourceManifestRevision must remain '{ProductIdentity.LegacySourceManifestRevision}' unless an explicit adapter ADR exists.");
        }

        if (options.SdkVersions.IdentityAlgorithmVersion != ProductIdentity.IdentityAlgorithmVersion)
        {
            errors.Add(
                $"SdkVersions.IdentityAlgorithmVersion mismatch; expected '{ProductIdentity.IdentityAlgorithmVersion}'.");
        }

        if (options.Scoring.ExperimentalMlEnabled || options.FeatureFlags.ExperimentalMl == FeatureFlagMode.Enabled)
        {
            errors.Add("Experimental ML must not be enabled as a default/silent production path; keep FeatureFlags.ExperimentalMl Disabled or Shadow only after explicit review.");
        }

        if (options.FeatureFlags.ExperimentalMl == FeatureFlagMode.Enabled)
        {
            errors.Add("FeatureFlags.ExperimentalMl=Enabled is rejected at startup.");
        }

        if (options.IpDatasets.AllowOutboundLookup)
        {
            errors.Add("IpDatasets.AllowOutboundLookup must be false for Self-hosted / air-gapped deployments.");
        }

        if (!string.Equals(options.IpDatasets.Mode, "offline_bundle", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(options.IpDatasets.Mode, "disabled", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("IpDatasets.Mode must be 'offline_bundle' or 'disabled'.");
        }

        ValidateConnectionString(options.Storage.ConnectionString, "Storage.ConnectionString", errors);
        ValidateConnectionString(options.Redis.ConnectionString, "Redis.ConnectionString", errors);

        if (options.EnvironmentName == DeploymentEnvironment.Production)
        {
            if (string.IsNullOrWhiteSpace(options.Storage.ConnectionString))
            {
                errors.Add("Production requires Storage.ConnectionString.");
            }

            if (options.Redis.Required && string.IsNullOrWhiteSpace(options.Redis.ConnectionString))
            {
                errors.Add("Production requires Redis.ConnectionString when Redis:Required=true.");
            }
        }

        foreach (var (tenantId, ov) in options.TenantOverrides)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                errors.Add("TenantOverrides keys must be non-empty tenant ids.");
            }

            if (ov.RetentionDays is < 1 or > 3650)
            {
                errors.Add($"TenantOverrides[{tenantId}].RetentionDays out of range.");
            }
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }

    private static void ValidateConnectionString(string? cs, string label, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(cs))
        {
            return;
        }

        var lower = cs.ToLowerInvariant();
        foreach (var fragment in DangerousCredentialPatterns)
        {
            if (lower.Contains(fragment, StringComparison.Ordinal))
            {
                errors.Add($"{label} appears to use a dangerous default credential pattern ('{fragment}').");
                break;
            }
        }

        if (ProductIdentity.ForbiddenHostFragments.Any(f => lower.Contains(f, StringComparison.Ordinal)))
        {
            errors.Add($"{label} must not point at vendor Fingerprint hosts.");
        }
    }
}
