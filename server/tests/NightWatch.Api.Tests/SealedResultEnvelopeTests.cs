using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NightWatch.Modules.Identity;

namespace NightWatch.Api.Tests;

public class SealedResultEnvelopeTests
{
    [Fact]
    public void Bit_flip_wrong_audience_stale_and_nonce_replay_rejected()
    {
        var svc = new SealedResultEnvelopeService(new SealedEnvelopeOptions
        {
            DefaultTtl = TimeSpan.FromMinutes(2)
        });

        var sealedEnv = svc.Seal(new SealRequest(
            Audience: "https://backend.example.ir",
            EventId: "ev_seal_1",
            TenantId: "ten_a",
            ClientVisiblePayload: new { visitorId = "v_1", matchType = "created" }));

        var ok = svc.Unseal(sealedEnv, "https://backend.example.ir", consumeOnce: true);
        Assert.True(ok.Ok);
        Assert.Equal("ev_seal_1", ok.EventId);

        // Repeated nonce / one-time use
        var replay = svc.Unseal(sealedEnv, "https://backend.example.ir", consumeOnce: true);
        Assert.False(replay.Ok);
        Assert.Equal("nonce_replay", replay.Code);

        // Fresh seal for remaining cases
        var env2 = svc.Seal(new SealRequest("https://backend.example.ir", "ev_seal_2", "ten_a", new { x = 1 }));
        // Audience is bound in AAD — wrong audience fails authenticated decrypt.
        Assert.Equal("decrypt_failed", svc.Unseal(env2, "https://other.example.ir", consumeOnce: false).Code);

        // Bit flip in ciphertext
        var pack = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(env2))).RootElement;
        var c = Convert.FromBase64String(pack.GetProperty("c").GetString()!);
        c[0] ^= 0x01;
        var flipped = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new
        {
            kid = pack.GetProperty("kid").GetString(),
            aad = pack.GetProperty("aad").GetString(),
            n = pack.GetProperty("n").GetString(),
            c = Convert.ToBase64String(c),
            t = pack.GetProperty("t").GetString()
        }));
        Assert.Equal("decrypt_failed", svc.Unseal(flipped, "https://backend.example.ir", consumeOnce: false).Code);

        // Stale envelope
        var staleSvc = new SealedResultEnvelopeService(new SealedEnvelopeOptions
        {
            DefaultTtl = TimeSpan.FromSeconds(-5)
        });
        var stale = staleSvc.Seal(new SealRequest("https://backend.example.ir", "ev_stale", "ten_a", new { }));
        Assert.Equal("stale_envelope", staleSvc.Unseal(stale, "https://backend.example.ir", consumeOnce: false).Code);

        // Rotation still decrypts with previous key when kid matches previous
        var key2 = RandomNumberGenerator.GetBytes(32);
        svc.RotateKey(key2, "k2");
        var env3 = svc.Seal(new SealRequest("https://backend.example.ir", "ev_seal_3", "ten_a", new { ok = true }));
        Assert.True(svc.Unseal(env3, "https://backend.example.ir", consumeOnce: false).Ok);
    }
}
