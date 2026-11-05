using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Identity;

public sealed class FirstPartyCookieOptions
{
    public string SigningKey { get; set; } = "night-watch-dev-cookie-key-change-me";
    public string CookieName { get; set; } = "__Host-ibf_sid";
    public string Path { get; set; } = "/";
    public string? Domain { get; set; } // null → host-only (__Host- requires no Domain)
    public TimeSpan Ttl { get; set; } = TimeSpan.FromDays(30);
    public HashSet<string> AllowedPurposes { get; set; } = new(StringComparer.Ordinal)
    {
        "fraud_prevention",
        "account_security",
        "lab_inventory"
    };
    public HashSet<string> AllowedLegalBases { get; set; } = new(StringComparer.Ordinal)
    {
        "legitimate_interest",
        "consent"
    };
}

public sealed record SessionCookieIssueRequest(
    string TenantId,
    string ProjectId,
    string Purpose,
    string LegalBasis,
    string? ExistingToken = null);

public sealed record SessionCookieAttributes(
    string Name,
    string Value,
    string Path,
    string? Domain,
    bool HttpOnly,
    bool Secure,
    string SameSite,
    DateTimeOffset ExpiresAt);

public sealed record SessionCookieValidation(
    bool Valid,
    string? Code,
    string? ContinuityId,
    string? ProjectId,
    string ContinuityClaim);

public interface IFirstPartySessionCookieService
{
    SessionCookieAttributes? Issue(SessionCookieIssueRequest request);
    SessionCookieValidation Validate(string? cookieValue, string expectedProjectId);
    bool Revoke(string continuityId);
    void RotateSigningKey(string newKey);
}

public sealed class FirstPartySessionCookieService(FirstPartyCookieOptions? options = null) : IFirstPartySessionCookieService
{
    private FirstPartyCookieOptions _options = options ?? new FirstPartyCookieOptions();
    private readonly ConcurrentDictionary<string, byte> _revoked = new(StringComparer.Ordinal);

    public SessionCookieAttributes? Issue(SessionCookieIssueRequest request)
    {
        if (!_options.AllowedPurposes.Contains(request.Purpose)
            || !_options.AllowedLegalBases.Contains(request.LegalBasis))
        {
            return null; // no cookie without legal basis/purpose
        }

        // Never treat as device authentication — continuity is optional soft binding.
        string continuityId;
        if (!string.IsNullOrWhiteSpace(request.ExistingToken))
        {
            var existing = Validate(request.ExistingToken, request.ProjectId);
            continuityId = existing.Valid && existing.ContinuityId is not null
                ? existing.ContinuityId
                : "c_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        }
        else
        {
            continuityId = "c_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        }

        var exp = DateTimeOffset.UtcNow.Add(_options.Ttl);
        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["cid"] = continuityId,
            ["tid"] = request.TenantId,
            ["pid"] = request.ProjectId,
            ["pur"] = request.Purpose,
            ["lb"] = request.LegalBasis,
            ["exp"] = exp.ToUnixTimeSeconds(),
            ["kind"] = "continuity_not_auth"
        });
        var payloadB64 = B64(Encoding.UTF8.GetBytes(payload));
        var sig = B64(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_options.SigningKey), Encoding.UTF8.GetBytes(payloadB64)));
        var value = $"v1.{payloadB64}.{sig}";

        return new SessionCookieAttributes(
            _options.CookieName,
            value,
            _options.Path,
            _options.Domain, // null for __Host-
            HttpOnly: true,
            Secure: true,
            SameSite: "Lax",
            ExpiresAt: exp);
    }

    public SessionCookieValidation Validate(string? cookieValue, string expectedProjectId)
    {
        const string claim =
            "no_claim_across_private_mode_cookie_clear_or_unrelated_browsers";

        if (string.IsNullOrWhiteSpace(cookieValue))
        {
            return new SessionCookieValidation(false, "missing", null, null, claim);
        }

        var parts = cookieValue.Split('.', 3);
        if (parts.Length != 3 || parts[0] != "v1")
        {
            return new SessionCookieValidation(false, "malformed", null, null, claim);
        }

        var expectedSig = B64(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_options.SigningKey), Encoding.UTF8.GetBytes(parts[1])));
        if (!FixedEq(expectedSig, parts[2]))
        {
            return new SessionCookieValidation(false, "tampered", null, null, claim);
        }

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(Pad(parts[1])));
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var cid = root.GetProperty("cid").GetString()!;
            var pid = root.GetProperty("pid").GetString()!;
            var exp = root.GetProperty("exp").GetInt64();

            if (_revoked.ContainsKey(cid))
            {
                return new SessionCookieValidation(false, "revoked", cid, pid, claim);
            }

            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
            {
                return new SessionCookieValidation(false, "expired", cid, pid, claim);
            }

            if (!string.Equals(pid, expectedProjectId, StringComparison.Ordinal))
            {
                return new SessionCookieValidation(false, "cross_project_replay", cid, pid, claim);
            }

            return new SessionCookieValidation(true, null, cid, pid, claim);
        }
        catch
        {
            return new SessionCookieValidation(false, "malformed", null, null, claim);
        }
    }

    public bool Revoke(string continuityId) => _revoked.TryAdd(continuityId, 1);

    public void RotateSigningKey(string newKey)
    {
        _options = new FirstPartyCookieOptions
        {
            SigningKey = newKey,
            CookieName = _options.CookieName,
            Path = _options.Path,
            Domain = _options.Domain,
            Ttl = _options.Ttl,
            AllowedPurposes = _options.AllowedPurposes,
            AllowedLegalBases = _options.AllowedLegalBases
        };
    }

    private static string B64(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Pad(string s)
    {
        var p = s.Replace('-', '+').Replace('_', '/');
        return (p.Length % 4) switch
        {
            2 => p + "==",
            3 => p + "=",
            _ => p
        };
    }

    private static bool FixedEq(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
