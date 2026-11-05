namespace NightWatch.BuildingBlocks;

public static class ProductIdentity
{
    public const string ProductName = "Night Watch";
    public const string ProductCode = "night-watch";
    public const string IdentityAlgorithmVersion = "night-watch-identity-v4";
    public const string ProcessingVersion = "night-watch-processing-v4";
    public const string LegacySourceManifestRevision = "default-v1";

    /// <summary>Forbidden runtime hosts (vendor SaaS / CDN telemetry).</summary>
    public static readonly string[] ForbiddenHostFragments =
    [
        "fingerprint.com",
        "fpjs.io",
        "openfpcdn",
        "fingerprintjs"
    ];

    public static bool IsForbiddenHost(string host)
    {
        var h = host.ToLowerInvariant();
        return ForbiddenHostFragments.Any(f => h.Contains(f, StringComparison.Ordinal));
    }
}
