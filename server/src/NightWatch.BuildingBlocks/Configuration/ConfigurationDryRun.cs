using Microsoft.Extensions.Options;

namespace NightWatch.BuildingBlocks.Configuration;

public sealed record ConfigurationDryRunResult(
    bool Ok,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Notes,
    bool WouldMakeOutboundCalls);

public static class ConfigurationDryRun
{
    /// <summary>
    /// Validates options without starting Kestrel or opening network sockets.
    /// </summary>
    public static ConfigurationDryRunResult Verify(ProPlusOptions options)
    {
        var validator = new ProPlusOptionsValidator();
        var result = validator.Validate(Options.DefaultName, options);
        var notes = new List<string>
        {
            $"environment={options.EnvironmentName}",
            $"identify={options.FeatureFlags.IdentifyApi}",
            $"smartSignals={options.FeatureFlags.SmartSignals}",
            $"experimentalMl={options.FeatureFlags.ExperimentalMl}",
            $"ipMode={options.IpDatasets.Mode}",
            "runtimeVendorSaas=false"
        };

        var wouldOutbound = options.IpDatasets.AllowOutboundLookup;
        if (!result.Succeeded)
        {
            return new ConfigurationDryRunResult(
                false,
                result.Failures?.ToArray() ?? ["configuration validation failed"],
                notes,
                wouldOutbound);
        }

        if (wouldOutbound)
        {
            return new ConfigurationDryRunResult(
                false,
                ["Configuration would enable outbound IP lookup calls after startup."],
                notes,
                true);
        }

        return new ConfigurationDryRunResult(true, Array.Empty<string>(), notes, false);
    }
}
