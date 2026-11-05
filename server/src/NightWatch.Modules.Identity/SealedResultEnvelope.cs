using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Identity;

public sealed class SealedEnvelopeOptions
{
    /// <summary>32-byte AES key (lab default). Rotate via RotateKey.</summary>
    public byte[] ActiveKey { get; set; } = SHA256.HashData("night-watch-dev-sealed-key-v1"u8.ToArray());
    public byte[]? PreviousKey { get; set; }
    public string KeyId { get; set; } = "k1";
    public string? PreviousKeyId { get; set; }
    public TimeSpan DefaultTtl { get; set; } = TimeSpan.FromMinutes(2);
    public string AadContractVersion { get; set; } = "aad-v1";
}

public sealed record SealRequest(
    string Audience,
    string EventId,
    string TenantId,
    object ClientVisiblePayload,
    TimeSpan? Ttl = null);

public sealed record UnsealResult(
    bool Ok,
    string? Code,
    string? EventId,
    string? Audience,
    JsonElement? Payload);

public interface ISealedResultEnvelopeService
{
    string Seal(SealRequest request);
    UnsealResult Unseal(string envelope, string expectedAudience, bool consumeOnce = true);
    void RotateKey(byte[] newKey, string newKeyId);
}

/// <summary>
/// AES-GCM sealed envelope for client→customer-backend transfer.
/// Scoring secrets stay server-side; only client-visible fields are sealed.
/// Never treat client-produced ciphertext as authoritative without this unseal path.
/// </summary>
public sealed class SealedResultEnvelopeService(SealedEnvelopeOptions? options = null) : ISealedResultEnvelopeService
{
    private SealedEnvelopeOptions _options = options ?? new SealedEnvelopeOptions();
    private readonly ConcurrentDictionary<string, byte> _spentNonces = new(StringComparer.Ordinal);

    public string Seal(SealRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var exp = now.Add(request.Ttl ?? _options.DefaultTtl);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(new
        {
            eventId = request.EventId,
            tenantId = request.TenantId,
            audience = request.Audience,
            iat = now.ToUnixTimeSeconds(),
            exp = exp.ToUnixTimeSeconds(),
            ver = "night-watch-sealed-v1",
            payload = request.ClientVisiblePayload
        });

        var aad = BuildAad(_options.KeyId, request.Audience);
        var cipher = new byte[plaintext.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(_options.ActiveKey, 16))
        {
            aes.Encrypt(nonce, plaintext, cipher, tag, aad);
        }

        var pack = new
        {
            kid = _options.KeyId,
            aad = _options.AadContractVersion,
            n = Convert.ToBase64String(nonce),
            c = Convert.ToBase64String(cipher),
            t = Convert.ToBase64String(tag)
        };
        return Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(pack));
    }

    public UnsealResult Unseal(string envelope, string expectedAudience, bool consumeOnce = true)
    {
        try
        {
            var packJson = Encoding.UTF8.GetString(Convert.FromBase64String(envelope));
            using var packDoc = JsonDocument.Parse(packJson);
            var root = packDoc.RootElement;
            var kid = root.GetProperty("kid").GetString()!;
            var aadVer = root.GetProperty("aad").GetString();
            if (aadVer != _options.AadContractVersion)
            {
                return Fail("aad_contract_mismatch");
            }

            var nonce = Convert.FromBase64String(root.GetProperty("n").GetString()!);
            var cipher = Convert.FromBase64String(root.GetProperty("c").GetString()!);
            var tag = Convert.FromBase64String(root.GetProperty("t").GetString()!);
            var nonceKey = Convert.ToHexString(nonce);

            if (consumeOnce && !_spentNonces.TryAdd(nonceKey, 1))
            {
                return Fail("nonce_replay");
            }

            byte[] key;
            if (kid == _options.KeyId)
            {
                key = _options.ActiveKey;
            }
            else if (kid == _options.PreviousKeyId && _options.PreviousKey is not null)
            {
                key = _options.PreviousKey;
            }
            else
            {
                return Fail("unknown_kid");
            }

            // Peek eventId/audience require decrypt — use provisional AAD with expected audience after decrypt of header-less blob.
            // AAD binds kid+audience+eventId; we trial-decrypt by parsing plaintext after decrypt with AAD built from expected audience
            // once we know eventId from a first decrypt attempt using aad with placeholder — instead embed audience in AAD only after
            // we decrypt with AAD = kid|aadVer|audience|eventId where audience is expectedAudience and eventId recovered via
            // decrypt attempt is circular. Contract: AAD = kid|aadVer|audience (eventId inside ciphertext).
            var aad = BuildAad(kid, expectedAudience);
            var plain = new byte[cipher.Length];
            try
            {
                using var aes = new AesGcm(key, 16);
                aes.Decrypt(nonce, cipher, tag, plain, aad);
            }
            catch (CryptographicException)
            {
                if (consumeOnce)
                {
                    _spentNonces.TryRemove(nonceKey, out _);
                }

                return Fail("decrypt_failed");
            }

            using var doc = JsonDocument.Parse(plain);
            var body = doc.RootElement;
            var audience = body.GetProperty("audience").GetString()!;
            var eventId = body.GetProperty("eventId").GetString()!;
            var exp = body.GetProperty("exp").GetInt64();

            if (!string.Equals(audience, expectedAudience, StringComparison.Ordinal))
            {
                return Fail("wrong_audience");
            }

            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp)
            {
                return Fail("stale_envelope");
            }

            return new UnsealResult(true, null, eventId, audience, body.GetProperty("payload").Clone());
        }
        catch
        {
            return Fail("malformed_envelope");
        }
    }

    public void RotateKey(byte[] newKey, string newKeyId)
    {
        if (newKey.Length != 32)
        {
            throw new ArgumentException("AES-256 key required", nameof(newKey));
        }

        _options = new SealedEnvelopeOptions
        {
            PreviousKey = _options.ActiveKey,
            PreviousKeyId = _options.KeyId,
            ActiveKey = newKey,
            KeyId = newKeyId,
            DefaultTtl = _options.DefaultTtl,
            AadContractVersion = _options.AadContractVersion
        };
    }

    private byte[] BuildAad(string kid, string audience)
    {
        // Explicit AAD contract: aad-v1|kid|audience (eventId stays in ciphertext)
        return Encoding.UTF8.GetBytes($"{_options.AadContractVersion}|{kid}|{audience}");
    }

    private static UnsealResult Fail(string code) => new(false, code, null, null, null);
}
