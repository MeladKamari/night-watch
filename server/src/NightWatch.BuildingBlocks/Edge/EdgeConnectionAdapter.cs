using System.Net;
using System.Net.Sockets;

namespace NightWatch.BuildingBlocks.Edge;

public sealed class EdgeConnectionAdapter(TrustedProxyOptions? options = null) : IEdgeConnectionAdapter
{
    private readonly TrustedProxyOptions _options = options ?? new TrustedProxyOptions();

    public EdgeConnectionMetadata Resolve(
        string? remoteIp,
        IReadOnlyDictionary<string, string> headers,
        bool isHttps,
        string? negotiatedTlsProtocol,
        string? httpProtocol)
    {
        var remote = NormalizeIp(remoteIp);
        var trustedHop = remote is not null && IsTrustedProxy(remote);

        EvidenceCell<string?> clientIp;
        string ingressTrust;

        if (trustedHop)
        {
            var forwarded = ExtractClientIpFromForwarded(headers);
            if (forwarded is null)
            {
                clientIp = Evidence.Unknown<string?>("edge", "missing_forwarded_client_ip");
                ingressTrust = "trusted_proxy_incomplete";
            }
            else
            {
                clientIp = Evidence.Known<string?>(forwarded, "edge", confidence: null);
                ingressTrust = "trusted_proxy";
            }
        }
        else
        {
            // Untrusted peer: ignore X-Forwarded-For entirely (anti-spoof).
            if (remote is null)
            {
                clientIp = Evidence.Unknown<string?>("edge", "remote_ip_unavailable");
                ingressTrust = "direct_unknown";
            }
            else
            {
                clientIp = Evidence.Known<string?>(remote, "edge", confidence: null);
                ingressTrust = "direct";
            }
        }

        EvidenceCell<string?> ipVersion = clientIp.Status == EvidenceStatus.Known && clientIp.Value is not null
            ? Evidence.Known<string?>(DetectIpVersion(clientIp.Value), "edge")
            : Evidence.Unknown<string?>("edge", "ip_version_unknown");

        var tls = Evidence.Known<bool?>(isHttps, "edge");
        EvidenceCell<string?> tlsProto = isHttps
            ? (string.IsNullOrWhiteSpace(negotiatedTlsProtocol)
                ? Evidence.Unknown<string?>("edge", "tls_protocol_not_exposed_by_ingress")
                : Evidence.Known<string?>(negotiatedTlsProtocol, "edge"))
            : Evidence.Unavailable<string?>("edge", "not_tls");

        EvidenceCell<string?> httpProto = string.IsNullOrWhiteSpace(httpProtocol)
            ? Evidence.Unknown<string?>("edge", "http_protocol_unavailable")
            : Evidence.Known<string?>(httpProtocol, "edge");

        return new EdgeConnectionMetadata(
            clientIp,
            ipVersion,
            tls,
            tlsProto,
            httpProto,
            ingressTrust,
            RetainedPacketPayload: false);
    }

    private string? ExtractClientIpFromForwarded(IReadOnlyDictionary<string, string> headers)
    {
        // Prefer RFC 7239 Forwarded; else left-most X-Forwarded-For only when hop is trusted.
        if (TryGetHeader(headers, "Forwarded", out var forwarded))
        {
            // for=1.2.3.4 or for="[2001:db8::1]"
            foreach (var part in forwarded.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                foreach (var kv in part.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                {
                    if (kv.StartsWith("for=", StringComparison.OrdinalIgnoreCase))
                    {
                        var raw = kv[4..].Trim().Trim('"');
                        if (raw.StartsWith('['))
                        {
                            var end = raw.IndexOf(']');
                            if (end > 1)
                            {
                                raw = raw[1..end];
                            }
                        }
                        else if (raw.Contains(':') && raw.Count(c => c == ':') == 1)
                        {
                            // IPv4:port
                            raw = raw.Split(':')[0];
                        }

                        return NormalizeIp(raw);
                    }
                }
            }
        }

        if (TryGetHeader(headers, "X-Forwarded-For", out var xff))
        {
            var first = xff.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .FirstOrDefault();
            return NormalizeIp(first);
        }

        return null;
    }

    private bool IsTrustedProxy(string ip)
    {
        if (!IPAddress.TryParse(ip, out var address))
        {
            return false;
        }

        foreach (var cidr in _options.TrustedProxyCidrs)
        {
            if (IpInCidr(address, cidr))
            {
                return true;
            }
        }

        return false;
    }

    public static string? NormalizeIp(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var v = value.Trim().Trim('[', ']');
        if (!IPAddress.TryParse(v, out var ip))
        {
            return null;
        }

        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        return ip.ToString();
    }

    internal static string DetectIpVersion(string ip) =>
        IPAddress.Parse(ip).AddressFamily == AddressFamily.InterNetworkV6 ? "ipv6" : "ipv4";

    public static bool IpInCidr(IPAddress address, string cidr)
    {
        var parts = cidr.Split('/', 2);
        if (!IPAddress.TryParse(parts[0], out var network))
        {
            return false;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (network.IsIPv4MappedToIPv6)
        {
            network = network.MapToIPv4();
        }

        if (address.AddressFamily != network.AddressFamily)
        {
            return false;
        }

        var prefix = parts.Length == 2 && int.TryParse(parts[1], out var p)
            ? p
            : (network.AddressFamily == AddressFamily.InterNetwork ? 32 : 128);

        var addrBytes = address.GetAddressBytes();
        var netBytes = network.GetAddressBytes();
        var fullBytes = prefix / 8;
        var remBits = prefix % 8;
        for (var i = 0; i < fullBytes; i++)
        {
            if (addrBytes[i] != netBytes[i])
            {
                return false;
            }
        }

        if (remBits == 0)
        {
            return true;
        }

        var mask = (byte)~(0xFF >> remBits);
        return (addrBytes[fullBytes] & mask) == (netBytes[fullBytes] & mask);
    }

    private static bool TryGetHeader(IReadOnlyDictionary<string, string> headers, string name, out string value)
    {
        foreach (var kv in headers)
        {
            if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase))
            {
                value = kv.Value;
                return !string.IsNullOrWhiteSpace(value);
            }
        }

        value = "";
        return false;
    }
}
