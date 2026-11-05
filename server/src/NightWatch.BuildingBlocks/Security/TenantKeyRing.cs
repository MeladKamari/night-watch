using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace NightWatch.BuildingBlocks.Security;

public enum ApiKeyKind
{
    PublicCollect,
    ServerSecret,
    Management
}

public sealed record TenantKey(
    string TenantId,
    string KeyId,
    ApiKeyKind Kind,
    byte[] PublicKey,
    byte[]? PrivateKey,
    DateTimeOffset CreatedAt,
    DateTimeOffset? RotatedAt);

public sealed class TenantAccessDenialException : Exception
{
    public TenantAccessDenialException(string message) : base(message) { }
}

/// <summary>
/// In-memory Ed25519-style key ring using ECDSA P-256 as audited platform primitive available in-box.
/// Private keys never leave the server process; public collect keys are exportable.
/// </summary>
public sealed class TenantKeyRing
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, TenantKey>> _keys = new();

    public TenantKey CreateKey(string tenantId, ApiKeyKind kind)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pub = ecdsa.ExportSubjectPublicKeyInfo();
        var priv = kind == ApiKeyKind.PublicCollect ? null : ecdsa.ExportPkcs8PrivateKey();
        var key = new TenantKey(
            tenantId,
            $"kid_{Guid.NewGuid():N}"[..20],
            kind,
            pub,
            priv,
            DateTimeOffset.UtcNow,
            null);
        var bag = _keys.GetOrAdd(tenantId, _ => new ConcurrentDictionary<string, TenantKey>());
        bag[key.KeyId] = key;
        return key with { PrivateKey = kind == ApiKeyKind.PublicCollect ? null : key.PrivateKey };
    }

    public TenantKey GetKey(string tenantId, string keyId)
    {
        if (!_keys.TryGetValue(tenantId, out var bag) || !bag.TryGetValue(keyId, out var key))
        {
            throw new TenantAccessDenialException("key_not_found");
        }
        return key with { PrivateKey = key.Kind == ApiKeyKind.PublicCollect ? null : key.PrivateKey };
    }

    public byte[] Sign(string tenantId, string keyId, ReadOnlySpan<byte> payload)
    {
        var key = RequireSecretKey(tenantId, keyId);
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportPkcs8PrivateKey(key.PrivateKey!, out _);
        return ecdsa.SignData(payload, HashAlgorithmName.SHA256);
    }

    public bool Verify(string tenantId, string keyId, ReadOnlySpan<byte> payload, ReadOnlySpan<byte> signature)
    {
        var key = GetKey(tenantId, keyId);
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportSubjectPublicKeyInfo(key.PublicKey, out _);
        return ecdsa.VerifyData(payload, signature, HashAlgorithmName.SHA256);
    }

    public object LookupObject(string callerTenantId, string objectTenantId, string objectId)
    {
        if (!string.Equals(callerTenantId, objectTenantId, StringComparison.Ordinal))
        {
            throw new TenantAccessDenialException("cross_tenant_denied");
        }
        return new { objectId, tenantId = objectTenantId };
    }

    public static string RedactForLog(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains("BEGIN", StringComparison.Ordinal) || value.Length > 24)
        {
            return "[REDACTED]";
        }
        return value;
    }

    public static bool LooksLikeSecret(string text) =>
        text.Contains("PRIVATE KEY", StringComparison.OrdinalIgnoreCase)
        || text.Contains("ServerSecret", StringComparison.OrdinalIgnoreCase)
        || text.Contains("sk_live", StringComparison.OrdinalIgnoreCase);

    private TenantKey RequireSecretKey(string tenantId, string keyId)
    {
        var key = GetKey(tenantId, keyId);
        if (key.Kind == ApiKeyKind.PublicCollect || key.PrivateKey is null)
        {
            throw new TenantAccessDenialException("secret_key_required");
        }
        // Reload full private material from store
        return _keys[tenantId][keyId];
    }
}

public static class ReplayGuard
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> Seen = new();

    public static bool TryAccept(string tenantId, string nonce, TimeSpan ttl)
    {
        var key = tenantId + ":" + nonce;
        var now = DateTimeOffset.UtcNow;
        if (Seen.TryGetValue(key, out var prev) && now - prev < ttl)
        {
            return false;
        }
        Seen[key] = now;
        return true;
    }
}

public static class EnvelopeCrypto
{
    public static byte[] Protect(byte[] plaintext, byte[] key32)
    {
        if (key32.Length != 32) throw new ArgumentException("key must be 32 bytes");
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plaintext.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(key32, 16);
        aes.Encrypt(nonce, plaintext, cipher, tag);
        return nonce.Concat(tag).Concat(cipher).ToArray();
    }

    public static byte[] Unprotect(byte[] blob, byte[] key32)
    {
        var nonce = blob.AsSpan(0, 12);
        var tag = blob.AsSpan(12, 16);
        var cipher = blob.AsSpan(28);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(key32, 16);
        aes.Decrypt(nonce, cipher, tag, plain);
        return plain;
    }

    public static byte[] DeriveKey(string material) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(material));
}
