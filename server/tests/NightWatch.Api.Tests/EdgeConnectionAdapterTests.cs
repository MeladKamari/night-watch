using NightWatch.BuildingBlocks;
using NightWatch.BuildingBlocks.Edge;

namespace NightWatch.Api.Tests;

public class EdgeConnectionAdapterTests
{
    private readonly EdgeConnectionAdapter _adapter = new(new TrustedProxyOptions
    {
        TrustedProxyCidrs = ["10.0.0.0/8", "127.0.0.1/32"]
    });

    [Fact]
    public void Spoofed_xff_from_untrusted_client_is_ignored()
    {
        var meta = _adapter.Resolve(
            remoteIp: "203.0.113.50",
            headers: new Dictionary<string, string>
            {
                ["X-Forwarded-For"] = "198.51.100.1"
            },
            isHttps: true,
            negotiatedTlsProtocol: "TLS1.3",
            httpProtocol: "HTTP/2");

        Assert.Equal(EvidenceStatus.Known, meta.ClientIp.Status);
        Assert.Equal("203.0.113.50", meta.ClientIp.Value);
        Assert.Equal("direct", meta.IngressTrust);
        Assert.False(meta.RetainedPacketPayload);
    }

    [Fact]
    public void Trusted_proxy_uses_forwarded_client_ip_and_normalizes_v4_mapped_v6()
    {
        var meta = _adapter.Resolve(
            remoteIp: "10.1.2.3",
            headers: new Dictionary<string, string>
            {
                ["X-Forwarded-For"] = "::ffff:198.51.100.7, 10.1.2.3"
            },
            isHttps: true,
            negotiatedTlsProtocol: null,
            httpProtocol: "HTTP/1.1");

        Assert.Equal("198.51.100.7", meta.ClientIp.Value);
        Assert.Equal("ipv4", meta.IpVersion.Value);
        Assert.Equal("trusted_proxy", meta.IngressTrust);
        Assert.Equal(EvidenceStatus.Unknown, meta.TlsProtocol.Status);
        Assert.Equal("tls_protocol_not_exposed_by_ingress", meta.TlsProtocol.Reason);
    }

    [Fact]
    public void Missing_metadata_returns_unknown_not_fabricated_identity()
    {
        var meta = _adapter.Resolve(
            remoteIp: null,
            headers: new Dictionary<string, string>(),
            isHttps: false,
            negotiatedTlsProtocol: null,
            httpProtocol: null);

        Assert.Equal(EvidenceStatus.Unknown, meta.ClientIp.Status);
        Assert.Null(meta.ClientIp.Value);
        Assert.Equal(EvidenceStatus.Unavailable, meta.TlsProtocol.Status);
        Assert.False(meta.RetainedPacketPayload);
    }

    [Fact]
    public void Cidr_and_normalize_helpers()
    {
        Assert.Equal("1.2.3.4", EdgeConnectionAdapter.NormalizeIp("::ffff:1.2.3.4"));
        Assert.True(EdgeConnectionAdapter.IpInCidr(System.Net.IPAddress.Parse("10.9.8.7"), "10.0.0.0/8"));
        Assert.False(EdgeConnectionAdapter.IpInCidr(System.Net.IPAddress.Parse("11.0.0.1"), "10.0.0.0/8"));
    }
}
