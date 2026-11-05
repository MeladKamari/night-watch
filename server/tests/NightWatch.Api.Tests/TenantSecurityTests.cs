using System.Text;
using NightWatch.BuildingBlocks.Security;

namespace NightWatch.Api.Tests;

public class TenantSecurityTests
{
    [Fact]
    public void Cross_tenant_lookup_is_denied_without_data_leak()
    {
        var ring = new TenantKeyRing();
        ring.CreateKey("tenant_a", ApiKeyKind.ServerSecret);
        var ex = Assert.Throws<TenantAccessDenialException>(() =>
            ring.LookupObject("tenant_a", "tenant_b", "obj_1"));
        Assert.Equal("cross_tenant_denied", ex.Message);
    }

    [Fact]
    public void Sign_verify_and_replay_nonce()
    {
        var ring = new TenantKeyRing();
        var key = ring.CreateKey("tenant_a", ApiKeyKind.ServerSecret);
        var payload = Encoding.UTF8.GetBytes("event:ev_1");
        var sig = ring.Sign("tenant_a", key.KeyId, payload);
        Assert.True(ring.Verify("tenant_a", key.KeyId, payload, sig));
        Assert.True(ReplayGuard.TryAccept("tenant_a", "nonce-1", TimeSpan.FromMinutes(5)));
        Assert.False(ReplayGuard.TryAccept("tenant_a", "nonce-1", TimeSpan.FromMinutes(5)));
    }

    [Fact]
    public void Envelope_crypto_roundtrips_and_logs_redact_secrets()
    {
        var key = EnvelopeCrypto.DeriveKey("lab-material");
        var blob = EnvelopeCrypto.Protect(Encoding.UTF8.GetBytes("hello"), key);
        Assert.Equal("hello", Encoding.UTF8.GetString(EnvelopeCrypto.Unprotect(blob, key)));
        Assert.Equal("[REDACTED]", TenantKeyRing.RedactForLog("-----BEGIN PRIVATE KEY-----abc"));
        Assert.True(TenantKeyRing.LooksLikeSecret("sk_live_example"));
    }

    [Fact]
    public void Public_collect_key_has_no_private_material_exported()
    {
        var ring = new TenantKeyRing();
        var key = ring.CreateKey("tenant_a", ApiKeyKind.PublicCollect);
        Assert.Null(key.PrivateKey);
    }
}
