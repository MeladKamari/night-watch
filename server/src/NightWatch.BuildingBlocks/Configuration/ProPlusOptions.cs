using System.ComponentModel.DataAnnotations;

namespace NightWatch.BuildingBlocks.Configuration;

public enum DeploymentEnvironment
{
    Development,
    Staging,
    Production
}

public enum FeatureFlagMode
{
    Disabled = 0,
    Enabled = 1,
    Shadow = 2
}

public sealed class ProPlusOptions
{
    public const string SectionName = "NightWatch";

    [Required]
    public DeploymentEnvironment EnvironmentName { get; set; } = DeploymentEnvironment.Development;

    public StorageOptions Storage { get; set; } = new();
    public RedisOptions Redis { get; set; } = new();
    public ScoringOptions Scoring { get; set; } = new();
    public IpDatasetOptions IpDatasets { get; set; } = new();
    public KeyRotationOptions KeyRotation { get; set; } = new();
    public PrivacyOptions Privacy { get; set; } = new();
    public SdkVersionOptions SdkVersions { get; set; } = new();
    public FeatureFlagOptions FeatureFlags { get; set; } = new();
    public Dictionary<string, TenantOverrideOptions> TenantOverrides { get; set; } = new(StringComparer.Ordinal);
}

public sealed class StorageOptions
{
    public string Provider { get; set; } = "postgresql";
    public string? ConnectionString { get; set; }
}

public sealed class RedisOptions
{
    public string? ConnectionString { get; set; }
    public bool Required { get; set; }
}

public sealed class ScoringOptions
{
    public bool Enabled { get; set; }
    /// <summary>Experimental ML must never silently default on.</summary>
    public bool ExperimentalMlEnabled { get; set; }
    public string ModelVersion { get; set; } = "none";
}

public sealed class IpDatasetOptions
{
    public string Mode { get; set; } = "offline_bundle";
    public string? BundlePath { get; set; }
    public bool AllowOutboundLookup { get; set; }
}

public sealed class KeyRotationOptions
{
    [Range(1, 365)]
    public int MaxKeyAgeDays { get; set; } = 90;
}

public sealed class PrivacyOptions
{
    [Range(1, 3650)]
    public int DefaultRetentionDays { get; set; } = 90;
    public bool RequirePurposeOnIngest { get; set; } = true;
}

public sealed class SdkVersionOptions
{
    public string MinBrowserSdk { get; set; } = "0.1.0-rc.1";
    public string LegacySourceManifestRevision { get; set; } = ProductIdentity.LegacySourceManifestRevision;
    public string IdentityAlgorithmVersion { get; set; } = ProductIdentity.IdentityAlgorithmVersion;
}

public sealed class FeatureFlagOptions
{
    public FeatureFlagMode SmartSignals { get; set; } = FeatureFlagMode.Disabled;
    public FeatureFlagMode Webhooks { get; set; } = FeatureFlagMode.Disabled;
    public FeatureFlagMode ExperimentalMl { get; set; } = FeatureFlagMode.Disabled;
    public FeatureFlagMode IdentifyApi { get; set; } = FeatureFlagMode.Enabled;
}

public sealed class TenantOverrideOptions
{
    public FeatureFlagMode? SmartSignals { get; set; }
    public int? RetentionDays { get; set; }
}
