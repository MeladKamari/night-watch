using System.Security.Cryptography;
using System.Text;

namespace NightWatch.Modules.Identity.Matching;

public sealed record RawObservation(
    string? Platform,
    string? OsFamily,
    string? BrowserFamily,
    string? Locale,
    int? ScreenWidth,
    int? ScreenHeight,
    string? WebGlRenderer,
    string? SourceVersion,
    IReadOnlyDictionary<string, string?>? ExtraRaw);

public sealed record NormalizedFeature(
    string Key,
    string? Value,
    string Status, // known | missing | unknown
    string SourceVersion);

public sealed record PrivacySafeVector(
    string VectorVersion,
    string TenantDomainSeparated,
    IReadOnlyList<NormalizedFeature> Features);

public static class FeatureNormalizer
{
    public const string VectorVersion = "night-watch-vector-v1";

    public static PrivacySafeVector Normalize(RawObservation obs, string tenantId, string tenantSecret)
    {
        var features = new List<NormalizedFeature>
        {
            Fam("os_family", NormalizeOs(obs.OsFamily ?? obs.Platform), obs.SourceVersion),
            Fam("browser_family", NormalizeBrowser(obs.BrowserFamily), obs.SourceVersion),
            Fam("locale", NormalizeLocale(obs.Locale), obs.SourceVersion),
            Fam("resolution_bucket", ResolutionBucket(obs.ScreenWidth, obs.ScreenHeight), obs.SourceVersion),
            Fam("graphics_trait", HashOrMissing(obs.WebGlRenderer, tenantId, tenantSecret), obs.SourceVersion)
        };

        if (obs.ExtraRaw is not null)
        {
            foreach (var (k, v) in obs.ExtraRaw.OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                if (string.Equals(k, "applePay", StringComparison.Ordinal))
                {
                    continue;
                }

                features.Add(Fam($"raw:{k}", v is null ? null : HashOrMissing(v, tenantId, tenantSecret), obs.SourceVersion));
            }
        }

        return new PrivacySafeVector(VectorVersion, DomainSep(tenantId, tenantSecret), features);
    }

    private static NormalizedFeature Fam(string key, string? value, string? sourceVersion) =>
        new(key, value, value is null ? "missing" : "known", sourceVersion ?? "unknown");

    public static string? NormalizeOs(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var r = raw.ToLowerInvariant();
        if (r.Contains("win")) return "windows";
        if (r.Contains("mac") || r.Contains("darwin")) return "macos";
        if (r.Contains("android")) return "android";
        if (r.Contains("ios") || r.Contains("iphone") || r.Contains("ipad")) return "ios";
        if (r.Contains("linux")) return "linux";
        return "other";
    }

    public static string? NormalizeBrowser(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var r = raw.ToLowerInvariant();
        if (r.Contains("edg")) return "edge";
        if (r.Contains("chrome") || r.Contains("crios")) return "chrome";
        if (r.Contains("firefox") || r.Contains("fxios")) return "firefox";
        if (r.Contains("safari")) return "safari";
        return "other";
    }

    public static string? NormalizeLocale(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var primary = raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return primary?.Replace('_', '-').ToLowerInvariant();
    }

    public static string? ResolutionBucket(int? w, int? h)
    {
        if (w is null || h is null) return null;
        var bw = w.Value switch
        {
            < 800 => "s",
            < 1400 => "m",
            < 2000 => "l",
            _ => "xl"
        };
        var bh = h.Value switch
        {
            < 700 => "s",
            < 1000 => "m",
            < 1400 => "l",
            _ => "xl"
        };
        return $"{bw}x{bh}";
    }

    private static string? HashOrMissing(string? raw, string tenantId, string secret)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var material = Encoding.UTF8.GetBytes($"{DomainSep(tenantId, secret)}|{raw}");
        return Convert.ToHexString(SHA256.HashData(material)).ToLowerInvariant()[..16];
    }

    private static string DomainSep(string tenantId, string secret) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(tenantId)))
            .ToLowerInvariant()[..16];
}
