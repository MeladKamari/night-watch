using NightWatch.Modules.Risk.SmartSignals;

namespace NightWatch.Modules.Risk.Reputation;

public sealed record NetworkLookupContext(
    string? ForwardedFor,
    string? ClientIp,
    string? ClientAsn);

/// <summary>
/// Applies offline ASN/IP reputation into SmartSignal hints (honest unknown when absent).
/// </summary>
public static class NetworkReputationEnricher
{
    public static SmartSignalInput Enrich(
        SmartSignalInput input,
        NetworkLookupContext ctx,
        AsnReputationStore store)
    {
        var now = DateTimeOffset.UtcNow;
        bool? vpn = input.VpnHints;
        bool? proxy = input.ProxyHints;
        bool? blocklist = input.BlocklistHit;
        var asnStatus = input.AsnStatus;
        var geo = input.GeoRegion;
        var anyKnown = false;

        foreach (var key in CandidateKeys(ctx, input))
        {
            var (status, rec) = store.Lookup(key, now);
            if (status == "stale")
            {
                asnStatus ??= "stale";
                continue;
            }

            if (status != "known" || rec is null)
            {
                continue;
            }

            anyKnown = true;
            asnStatus = "known";
            switch (rec.Kind)
            {
                case "vpn":
                case "tor":
                    vpn = true;
                    break;
                case "proxy":
                case "dc":
                    proxy = true;
                    break;
                case "abuse":
                    blocklist = true;
                    break;
                case "country":
                    if (rec.Label.StartsWith("geo:", StringComparison.OrdinalIgnoreCase))
                    {
                        geo ??= rec.Label["geo:".Length..];
                    }
                    else
                    {
                        geo ??= rec.Label;
                    }

                    break;
                case "ir_operator":
                case "cellular":
                    // metadata only — never imply guilt
                    break;
            }
        }

        if (anyKnown)
        {
            vpn ??= false;
            proxy ??= false;
            blocklist ??= false;
        }

        asnStatus ??= "unknown";
        return input with
        {
            VpnHints = vpn,
            ProxyHints = proxy,
            BlocklistHit = blocklist,
            GeoRegion = geo,
            AsnStatus = asnStatus
        };
    }

    private static IEnumerable<string> CandidateKeys(NetworkLookupContext ctx, SmartSignalInput input)
    {
        if (!string.IsNullOrWhiteSpace(ctx.ForwardedFor))
        {
            var first = ctx.ForwardedFor.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(first))
            {
                yield return "ip:" + first;
            }
        }

        if (!string.IsNullOrWhiteSpace(ctx.ClientIp))
        {
            yield return "ip:" + ctx.ClientIp.Trim();
        }

        if (!string.IsNullOrWhiteSpace(ctx.ClientAsn))
        {
            var raw = ctx.ClientAsn.Trim();
            yield return raw.StartsWith("asn:", StringComparison.OrdinalIgnoreCase)
                ? raw.ToLowerInvariant()
                : "asn:" + raw;
        }

        if (!string.IsNullOrWhiteSpace(input.AsnStatus)
            && input.AsnStatus!.StartsWith("asn:", StringComparison.OrdinalIgnoreCase))
        {
            yield return input.AsnStatus.ToLowerInvariant();
        }
    }
}
