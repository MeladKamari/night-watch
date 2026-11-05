using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace NightWatch.Modules.Risk.Bots;

public enum BotIdentityClass
{
    VerifiedGoodBot,
    VerifiedAgent,
    SpoofedUserAgent,
    PrivateAllowlistedBot,
    Unknown
}

public sealed record BotIdentityResult(
    BotIdentityClass Classification,
    string Status, // known | unknown | unsupported
    string? Provider,
    IReadOnlyList<string> Evidence);

/// <summary>
/// Locally verifiable signed agent identity. Never trusts bare User-Agent for verified labels.
/// </summary>
public sealed class BotIdentityVerifier
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _tenantAllowlist = new(StringComparer.Ordinal);
    private readonly byte[] _trustAnchorKey;

    public BotIdentityVerifier(string trustAnchorKey = "night-watch-dev-bot-anchor")
    {
        _trustAnchorKey = Encoding.UTF8.GetBytes(trustAnchorKey);
    }

    public void AllowlistPrivateBot(string tenantId, string botId) =>
        _tenantAllowlist.GetOrAdd(tenantId, _ => new HashSet<string>(StringComparer.Ordinal)).Add(botId);

    public BotIdentityResult Verify(
        string tenantId,
        string? userAgent,
        string? signedIdentityHeader,
        DateTimeOffset now,
        string? privateBotId = null)
    {
        if (privateBotId is not null &&
            _tenantAllowlist.TryGetValue(tenantId, out var set) &&
            set.Contains(privateBotId))
        {
            return new BotIdentityResult(BotIdentityClass.PrivateAllowlistedBot, "known", "tenant_allowlist", ["private_bot_allowlisted"]);
        }

        if (string.IsNullOrWhiteSpace(signedIdentityHeader))
        {
            if (!string.IsNullOrWhiteSpace(userAgent) && LooksLikeBotUa(userAgent))
            {
                return new BotIdentityResult(BotIdentityClass.SpoofedUserAgent, "known", null, ["ua_bot_like_without_signature"]);
            }

            return new BotIdentityResult(BotIdentityClass.Unknown, "unknown", null, ["no_signed_identity"]);
        }

        if (!TryParse(signedIdentityHeader, out var provider, out var botId, out var issued, out var sig) ||
            !VerifySig(provider, botId, issued, sig))
        {
            return new BotIdentityResult(BotIdentityClass.SpoofedUserAgent, "known", null, ["forged_or_malformed_signature"]);
        }

        if (now - issued > TimeSpan.FromMinutes(5) || issued > now.AddMinutes(1))
        {
            return new BotIdentityResult(BotIdentityClass.Unknown, "unknown", provider, ["stale_or_future_identity"]);
        }

        var cls = provider.StartsWith("agent/", StringComparison.OrdinalIgnoreCase)
            ? BotIdentityClass.VerifiedAgent
            : BotIdentityClass.VerifiedGoodBot;
        return new BotIdentityResult(cls, "known", provider, ["signature_ok", $"bot={botId}"]);
    }

    public static string MintForTests(string trustAnchorKey, string provider, string botId, DateTimeOffset issued)
    {
        var payload = $"{provider}|{botId}|{issued.ToUnixTimeSeconds()}";
        var sig = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(trustAnchorKey), Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return $"bot1.{Convert.ToBase64String(Encoding.UTF8.GetBytes(payload))}.{sig}";
    }

    private bool VerifySig(string provider, string botId, DateTimeOffset issued, string sig)
    {
        var payload = $"{provider}|{botId}|{issued.ToUnixTimeSeconds()}";
        var expect = Convert.ToHexString(HMACSHA256.HashData(_trustAnchorKey, Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        var a = Encoding.UTF8.GetBytes(expect);
        var b = Encoding.UTF8.GetBytes(sig.ToLowerInvariant());
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    private static bool TryParse(string header, out string provider, out string botId, out DateTimeOffset issued, out string sig)
    {
        provider = botId = sig = "";
        issued = default;
        var parts = header.Split('.', 3);
        if (parts.Length != 3 || parts[0] != "bot1") return false;
        try
        {
            var payload = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
            var bits = payload.Split('|', 3);
            if (bits.Length != 3) return false;
            provider = bits[0];
            botId = bits[1];
            issued = DateTimeOffset.FromUnixTimeSeconds(long.Parse(bits[2]));
            sig = parts[2];
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool LooksLikeBotUa(string ua) =>
        ua.Contains("bot", StringComparison.OrdinalIgnoreCase) ||
        ua.Contains("spider", StringComparison.OrdinalIgnoreCase) ||
        ua.Contains("crawler", StringComparison.OrdinalIgnoreCase);
}
