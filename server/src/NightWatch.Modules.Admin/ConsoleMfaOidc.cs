using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace NightWatch.Modules.Admin;

public sealed class ConsoleOidcOptions
{
    public bool Enabled { get; set; }
    public string? Issuer { get; set; }
    public string? ClientId { get; set; }
    public string? RedirectUri { get; set; }
    public string? Scopes { get; set; } = "openid profile email";
}

public sealed class ConsoleMfaOptions
{
    /// <summary>When false (default), password login issues session directly. Set true for lab MFA gate.</summary>
    public bool Enabled { get; set; }
}

public sealed record ConsoleMfaChallengeResponse(
    bool MfaRequired,
    string MfaToken,
    string Method,
    DateTimeOffset ExpiresAt);

public interface IConsoleMfaService
{
    bool IsMfaEnabled(string username);
    string IssueChallenge(string username);
    (bool Ok, ConsoleLoginResponse? Session, string? Code) Verify(string mfaToken, string code);
}

/// <summary>
/// Lab MFA: fixed TOTP-like shared secret; accepts code "000000" for automation, or HMAC truncated code.
/// Full OIDC/MFA IdP integration remains configuration-driven via ConsoleOidcOptions.
/// </summary>
public sealed class ConsoleMfaService(IConsoleAuthService auth, ConsoleMfaOptions? options = null) : IConsoleMfaService
{
    public const string LabAcceptCode = "000000";
    private readonly ConsoleMfaOptions _options = options ?? new ConsoleMfaOptions();
    private static readonly ConcurrentDictionary<string, (string Username, DateTimeOffset Exp)> Challenges = new(StringComparer.Ordinal);
    private static readonly HashSet<string> MfaUsers = new(StringComparer.OrdinalIgnoreCase) { "admin" };

    public bool IsMfaEnabled(string username) => _options.Enabled && MfaUsers.Contains(username);

    public string IssueChallenge(string username)
    {
        var token = "mfa_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        Challenges[token] = (username, DateTimeOffset.UtcNow.AddMinutes(5));
        return token;
    }

    public (bool Ok, ConsoleLoginResponse? Session, string? Code) Verify(string mfaToken, string code)
    {
        if (!Challenges.TryRemove(mfaToken, out var chal) || chal.Exp < DateTimeOffset.UtcNow)
        {
            return (false, null, "mfa_expired");
        }

        if (!IsValidLabCode(chal.Username, code))
        {
            return (false, null, "mfa_invalid_code");
        }

        // Re-login without password after MFA — issue session via auth by minting through Login is awkward;
        // use a dedicated path on ConsoleAuthService via ValidateSession after synthetic login.
        if (auth is ConsoleAuthService concrete)
        {
            var session = concrete.IssueSessionForUser(chal.Username);
            return session is null ? (false, null, "mfa_user_missing") : (true, session, null);
        }

        return (false, null, "mfa_unsupported_auth_impl");
    }

    private static bool IsValidLabCode(string username, string code)
    {
        if (string.Equals(code, LabAcceptCode, StringComparison.Ordinal)) return true;
        var material = Encoding.UTF8.GetBytes($"night-watch-mfa|{username}|{DateTimeOffset.UtcNow:yyyyMMddHH}");
        var hash = HMACSHA256.HashData("night-watch-lab-mfa"u8.ToArray(), material);
        var expected = (BitConverter.ToUInt32(hash, 0) % 1_000_000).ToString("D6");
        return FixedEq(expected, code);
    }

    private static bool FixedEq(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
