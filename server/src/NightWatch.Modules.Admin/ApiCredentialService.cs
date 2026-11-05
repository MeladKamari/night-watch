using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Admin;

public enum ApiKeyKind
{
    Public,
    Server,
    Secret
}

public sealed class ApiCredentialRecord
{
    public required string KeyId { get; init; }
    public required string PublicId { get; init; }
    public required string TenantId { get; init; }
    public required string EnvironmentId { get; init; }
    public required ApiKeyKind Kind { get; init; }
    public required string Prefix { get; init; }
    public required string SecretHash { get; set; }
    public required HashSet<string> Scopes { get; init; }
    public required HashSet<string> DomainAllowlist { get; init; }
    public int QuotaPerMinute { get; init; }
    public bool TrustedIngestion { get; init; }
    public bool Revoked { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RotatedAt { get; set; }
    public long UsageCount { get; set; }
}

public sealed class CreatedApiKey
{
    public required ApiCredentialRecord Record { get; init; }
    /// <summary>Full secret shown once; never stored in plaintext.</summary>
    public required string SecretOnce { get; init; }
}

public sealed class AuthzDecision
{
    public required bool Allowed { get; init; }
    public string? Code { get; init; }
    public string? Detail { get; init; }
    public ApiCredentialRecord? Key { get; init; }
}

public interface IApiCredentialService
{
    CreatedApiKey Create(
        string tenantId,
        string environmentId,
        ApiKeyKind kind,
        IEnumerable<string> scopes,
        IEnumerable<string> domains,
        int quotaPerMinute,
        bool trustedIngestion,
        string actor);
    IReadOnlyList<object> List(string tenantId, string environmentId);
    bool Revoke(string tenantId, string keyId, string actor);
    CreatedApiKey? Rotate(string tenantId, string keyId, string actor);
    AuthzDecision Authorize(string? presentedKey, string requiredScope, string? origin = null);
    IReadOnlyList<object> Audit(string tenantId);
}

public sealed class ApiCredentialService(
    ILogger<ApiCredentialService> logger,
    IApiCredentialDurableSink? durable = null) : IApiCredentialService
{
    private readonly ConcurrentDictionary<string, ApiCredentialRecord> _keys = new(StringComparer.Ordinal);
    private readonly ConcurrentBag<object> _audit = [];
    private readonly ConcurrentDictionary<string, (int Count, DateTimeOffset Window)> _quota = new();
    private readonly IApiCredentialDurableSink _durable = durable ?? new NullApiCredentialDurableSink();

    /// <summary>Load persisted credentials after process restart (secret hash only; no plaintext).</summary>
    public void Hydrate(IEnumerable<ApiCredentialRecord> records)
    {
        foreach (var r in records)
        {
            _keys[r.KeyId] = r;
        }
    }

    public CreatedApiKey Create(
        string tenantId,
        string environmentId,
        ApiKeyKind kind,
        IEnumerable<string> scopes,
        IEnumerable<string> domains,
        int quotaPerMinute,
        bool trustedIngestion,
        string actor)
    {
        ValidateKindScopes(kind, scopes);
        var prefix = kind switch
        {
            ApiKeyKind.Public => "pk_live_",
            ApiKeyKind.Server => "sk_live_",
            ApiKeyKind.Secret => "sec_live_",
            _ => "key_"
        };
        var rawSecret = prefix + Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var keyId = "key_" + Guid.NewGuid().ToString("N")[..12];
        var record = new ApiCredentialRecord
        {
            KeyId = keyId,
            PublicId = "apk_" + Guid.NewGuid().ToString("N")[..10],
            TenantId = tenantId,
            EnvironmentId = environmentId,
            Kind = kind,
            Prefix = prefix,
            SecretHash = Hash(rawSecret),
            Scopes = scopes.ToHashSet(StringComparer.Ordinal),
            DomainAllowlist = domains.ToHashSet(StringComparer.OrdinalIgnoreCase),
            QuotaPerMinute = Math.Clamp(quotaPerMinute, 1, 100_000),
            TrustedIngestion = kind != ApiKeyKind.Public && trustedIngestion
        };
        _keys[keyId] = record;
        _durable.Upsert(record);
        Audit(tenantId, actor, "create", keyId, record.Kind.ToString());
        logger.LogInformation("api_key_created keyId={KeyId} kind={Kind} tenant={Tenant}", keyId, kind, tenantId);
        return new CreatedApiKey { Record = PublicView(record), SecretOnce = rawSecret };
    }

    public IReadOnlyList<object> List(string tenantId, string environmentId) =>
        _keys.Values
            .Where(k => k.TenantId == tenantId && k.EnvironmentId == environmentId)
            .Select(PublicView)
            .Cast<object>()
            .ToList();

    public bool Revoke(string tenantId, string keyId, string actor)
    {
        if (!_keys.TryGetValue(keyId, out var key) || key.TenantId != tenantId)
        {
            return false;
        }

        key.Revoked = true;
        key.RevokedAt = DateTimeOffset.UtcNow;
        _durable.MarkRevoked(key.TenantId, keyId, key.RevokedAt.Value);
        Audit(key.TenantId, actor, "revoke", keyId, null);
        return true;
    }

    public CreatedApiKey? Rotate(string tenantId, string keyId, string actor)
    {
        if (!_keys.TryGetValue(keyId, out var old) || old.TenantId != tenantId || old.Revoked)
        {
            return null;
        }

        old.Revoked = true;
        old.RevokedAt = DateTimeOffset.UtcNow;
        old.RotatedAt = DateTimeOffset.UtcNow;
        _durable.Upsert(old);
        Audit(old.TenantId, actor, "rotate_revoke_old", keyId, null);

        return Create(
            old.TenantId,
            old.EnvironmentId,
            old.Kind,
            old.Scopes,
            old.DomainAllowlist,
            old.QuotaPerMinute,
            old.TrustedIngestion,
            actor);
    }

    public AuthzDecision Authorize(string? presentedKey, string requiredScope, string? origin = null)
    {
        if (string.IsNullOrWhiteSpace(presentedKey))
        {
            return Deny("unauthorized", "API key required");
        }

        var match = _keys.Values.FirstOrDefault(k => FixedHashEquals(k.SecretHash, Hash(presentedKey)));
        if (match is null)
        {
            return Deny("unauthorized", "API key invalid");
        }

        // Revocation is immediate (TTL = 0).
        if (match.Revoked)
        {
            return Deny("key_revoked", "API key revoked");
        }

        if (match.Kind == ApiKeyKind.Public
            && (requiredScope.StartsWith("events:", StringComparison.Ordinal)
                || requiredScope.StartsWith("risk:", StringComparison.Ordinal)
                || requiredScope is "visitors:history" or "admin:*"))
        {
            return Deny("forbidden", "Public key cannot access visitor history or risk administration");
        }

        if (!match.Scopes.Contains(requiredScope) && !match.Scopes.Contains("*"))
        {
            return Deny("forbidden_scope", $"Missing scope {requiredScope}");
        }

        if (!string.IsNullOrWhiteSpace(origin) && match.DomainAllowlist.Count > 0)
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri)
                || !match.DomainAllowlist.Contains(originUri.Host))
            {
                return Deny("origin_forbidden", "Origin not on environment domain allowlist");
            }
        }

        if (!TryQuota(match.KeyId, match.QuotaPerMinute))
        {
            return Deny("quota_exceeded", "API key quota exceeded");
        }

        match.UsageCount++;
        return new AuthzDecision { Allowed = true, Key = PublicView(match) };
    }

    public IReadOnlyList<object> Audit(string tenantId) =>
        _audit.Where(a => a is Dictionary<string, object?> d && Equals(d.GetValueOrDefault("tenantId"), tenantId)).ToList();

    private void Audit(string tenantId, string actor, string action, string keyId, string? detail)
    {
        _audit.Add(new Dictionary<string, object?>
        {
            ["tenantId"] = tenantId,
            ["actor"] = actor,
            ["action"] = action,
            ["keyId"] = keyId,
            ["detail"] = detail,
            ["at"] = DateTimeOffset.UtcNow.ToString("O")
        });
    }

    private static void ValidateKindScopes(ApiKeyKind kind, IEnumerable<string> scopes)
    {
        var set = scopes.ToHashSet(StringComparer.Ordinal);
        if (kind == ApiKeyKind.Public
            && set.Any(s => s.StartsWith("events:", StringComparison.Ordinal) || s.StartsWith("risk:", StringComparison.Ordinal) || s == "admin:*"))
        {
            throw new InvalidOperationException("public_key_cannot_hold_privileged_scopes");
        }
    }

    private bool TryQuota(string keyId, int limit)
    {
        var now = DateTimeOffset.UtcNow;
        var entry = _quota.AddOrUpdate(
            keyId,
            _ => (1, now),
            (_, prev) => now - prev.Window > TimeSpan.FromMinutes(1) ? (1, now) : (prev.Count + 1, prev.Window));
        return entry.Count <= limit;
    }

    private static ApiCredentialRecord PublicView(ApiCredentialRecord r) =>
        new()
        {
            KeyId = r.KeyId,
            PublicId = r.PublicId,
            TenantId = r.TenantId,
            EnvironmentId = r.EnvironmentId,
            Kind = r.Kind,
            Prefix = r.Prefix,
            SecretHash = "***",
            Scopes = r.Scopes,
            DomainAllowlist = r.DomainAllowlist,
            QuotaPerMinute = r.QuotaPerMinute,
            TrustedIngestion = r.TrustedIngestion,
            Revoked = r.Revoked,
            RevokedAt = r.RevokedAt,
            CreatedAt = r.CreatedAt,
            RotatedAt = r.RotatedAt,
            UsageCount = r.UsageCount
        };

    private static string Hash(string secret) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret))).ToLowerInvariant();

    private static bool FixedHashEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    private static AuthzDecision Deny(string code, string detail) =>
        new() { Allowed = false, Code = code, Detail = detail };
}
