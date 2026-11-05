using NightWatch.BuildingBlocks;

namespace NightWatch.BuildingBlocks.Edge;

/// <summary>
/// Coarse, server-derived connection metadata. Not a unique device identity.
/// </summary>
public sealed record EdgeConnectionMetadata(
    EvidenceCell<string?> ClientIp,
    EvidenceCell<string?> IpVersion,
    EvidenceCell<bool?> IsTls,
    EvidenceCell<string?> TlsProtocol,
    EvidenceCell<string?> HttpProtocol,
    string IngressTrust,
    bool RetainedPacketPayload);

public sealed class TrustedProxyOptions
{
    /// <summary>CIDR or exact IPs of trusted reverse proxies (e.g. nginx gateway).</summary>
    public List<string> TrustedProxyCidrs { get; set; } =
    [
        "127.0.0.1/32",
        "::1/128",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16"
    ];
}

public interface IEdgeConnectionAdapter
{
    EdgeConnectionMetadata Resolve(
        string? remoteIp,
        IReadOnlyDictionary<string, string> headers,
        bool isHttps,
        string? negotiatedTlsProtocol,
        string? httpProtocol);
}
