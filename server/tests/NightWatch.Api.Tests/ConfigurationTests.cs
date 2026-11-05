using NightWatch.BuildingBlocks.Configuration;

namespace NightWatch.Api.Tests;

public class ConfigurationTests
{
    private static ProPlusOptions ValidDev() => new()
    {
        EnvironmentName = DeploymentEnvironment.Development,
        IpDatasets = new IpDatasetOptions { Mode = "offline_bundle", AllowOutboundLookup = false },
        FeatureFlags = new FeatureFlagOptions
        {
            ExperimentalMl = FeatureFlagMode.Disabled,
            IdentifyApi = FeatureFlagMode.Enabled,
            SmartSignals = FeatureFlagMode.Shadow
        },
        Scoring = new ScoringOptions { ExperimentalMlEnabled = false }
    };

    [Fact]
    public void DryRun_accepts_airgapped_dev_config()
    {
        var result = ConfigurationDryRun.Verify(ValidDev());
        Assert.True(result.Ok);
        Assert.False(result.WouldMakeOutboundCalls);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void DryRun_rejects_outbound_ip_lookup()
    {
        var opts = ValidDev();
        opts.IpDatasets.AllowOutboundLookup = true;
        var result = ConfigurationDryRun.Verify(opts);
        Assert.False(result.Ok);
        Assert.True(result.WouldMakeOutboundCalls);
        Assert.Contains(result.Errors, e => e.Contains("AllowOutboundLookup", StringComparison.OrdinalIgnoreCase)
            || e.Contains("outbound", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void DryRun_rejects_experimental_ml_enabled_flag()
    {
        var opts = ValidDev();
        opts.FeatureFlags.ExperimentalMl = FeatureFlagMode.Enabled;
        var result = ConfigurationDryRun.Verify(opts);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, e => e.Contains("ExperimentalMl", StringComparison.Ordinal));
    }

    [Fact]
    public void DryRun_rejects_dangerous_default_credentials()
    {
        var opts = ValidDev();
        opts.Storage.ConnectionString = "Host=db;Username=postgres;Password=postgres;Database=night_watch";
        var result = ConfigurationDryRun.Verify(opts);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, e => e.Contains("dangerous default", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void DryRun_rejects_production_without_storage()
    {
        var opts = ValidDev();
        opts.EnvironmentName = DeploymentEnvironment.Production;
        opts.Storage.ConnectionString = null;
        var result = ConfigurationDryRun.Verify(opts);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, e => e.Contains("Production requires Storage", StringComparison.Ordinal));
    }

    [Fact]
    public void Validator_rejects_vendor_host_in_connection_string()
    {
        var opts = ValidDev();
        opts.Redis.ConnectionString = "redis://api.fingerprint.com:6379";
        var result = ConfigurationDryRun.Verify(opts);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, e => e.Contains("vendor", StringComparison.OrdinalIgnoreCase));
    }
}
