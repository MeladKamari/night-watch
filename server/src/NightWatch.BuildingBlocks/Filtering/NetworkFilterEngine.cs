using System.Net;
using System.Text.Json;

namespace NightWatch.BuildingBlocks.Filtering;

public enum FilterLayer
{
    Edge,      // allow/deny at ingress — not risk scoring
    RiskPolicy // separate from edge; does not rewrite edge decision
}

public enum FilterAction
{
    Allow,
    Deny,
    Continue
}

public enum FilterField
{
    Origin,
    Domain,
    ClientIp,
    Asn,
    TrafficClass
}

public enum FilterOp
{
    Equals,
    In,
    CidrContains,
    Exists
}

public sealed record FilterPredicate(FilterField Field, FilterOp Op, string? Value, IReadOnlyList<string>? Values);

/// <summary>Simple AST node: all predicates AND-ed; rules ordered by Precedence ascending (lower wins).</summary>
public sealed record FilterRule(
    string RuleId,
    string EnvironmentId,
    FilterLayer Layer,
    int Precedence,
    FilterAction Action,
    IReadOnlyList<FilterPredicate> AllOf,
    bool Enabled = true,
    string? Reason = null);

public sealed record FilterRequestContext(
    string EnvironmentId,
    string? Origin,
    string? Domain,
    /// <summary>Only edge-resolved authoritative IP — never client-spoofed XFF alone.</summary>
    string? AuthoritativeClientIp,
    string? ClaimedOriginHeader,
    string? ClaimedForwardedIp,
    string? Asn,
    string AsnStatus, // known | unknown | unavailable | stale
    string? TrafficClass,
    bool LegitimateAutomation);

public sealed record FilterDecision(
    FilterAction EdgeAction,
    FilterAction RiskHint,
    string Outcome, // allow | deny | allow_default_unavailable
    string? MatchedEdgeRuleId,
    string? MatchedRiskRuleId,
    string Provenance,
    bool DryRun,
    string? Detail);

public interface INetworkFilterEngine
{
    void UpsertRule(FilterRule rule);
    IReadOnlyList<FilterRule> ListRules(string environmentId);
    FilterDecision Evaluate(FilterRequestContext ctx, bool dryRun);
    IReadOnlyList<object> AuditTrail(string environmentId);
}

public sealed class NetworkFilterEngine : INetworkFilterEngine
{
    private readonly Dictionary<string, FilterRule> _rules = new(StringComparer.Ordinal);
    private readonly List<object> _audit = [];

    public void UpsertRule(FilterRule rule) => _rules[rule.RuleId] = rule;

    public IReadOnlyList<FilterRule> ListRules(string environmentId) =>
        _rules.Values.Where(r => r.EnvironmentId == environmentId).OrderBy(r => r.Precedence).ToList();

    public FilterDecision Evaluate(FilterRequestContext ctx, bool dryRun)
    {
        // Spoofed Origin / XFF are never authoritative for matching IP/origin fields.
        var trustedOrigin = ctx.Origin;
        var trustedIp = ctx.AuthoritativeClientIp;

        var edge = ApplyLayer(FilterLayer.Edge, ctx, trustedOrigin, trustedIp);
        var risk = ApplyLayer(FilterLayer.RiskPolicy, ctx, trustedOrigin, trustedIp);

        FilterAction edgeAction;
        string outcome;
        string? detail;

        if (edge is not null)
        {
            edgeAction = edge.Action;
            outcome = edge.Action == FilterAction.Allow ? "allow" : "deny";
            detail = edge.Reason;
        }
        else if (ctx.LegitimateAutomation)
        {
            edgeAction = FilterAction.Allow;
            outcome = "allow";
            detail = "legitimate_automation_allowlist";
        }
        else if (ctx.AsnStatus is "stale" or "unavailable" or "unknown")
        {
            // Safe default when IP reputation / ASN unavailable — do not deny as risk.
            edgeAction = FilterAction.Allow;
            outcome = "allow_default_unavailable";
            detail = $"asn_{ctx.AsnStatus}_safe_default";
        }
        else
        {
            edgeAction = FilterAction.Allow;
            outcome = "allow";
            detail = "default_allow_no_match";
        }

        // Risk layer never overrides edge deny; it only hints.
        var riskHint = risk?.Action ?? FilterAction.Continue;
        if (edgeAction == FilterAction.Deny)
        {
            riskHint = FilterAction.Continue;
        }

        var decision = new FilterDecision(
            edgeAction,
            riskHint,
            outcome,
            edge?.RuleId,
            risk?.RuleId,
            "network_filter_engine",
            dryRun,
            detail);

        _audit.Add(new
        {
            env = ctx.EnvironmentId,
            dryRun,
            decision.Outcome,
            decision.MatchedEdgeRuleId,
            decision.MatchedRiskRuleId,
            spoofOriginIgnored = ctx.ClaimedOriginHeader != null && ctx.ClaimedOriginHeader != trustedOrigin,
            spoofIpIgnored = ctx.ClaimedForwardedIp != null && ctx.ClaimedForwardedIp != trustedIp,
            at = DateTimeOffset.UtcNow
        });

        return decision;
    }

    public IReadOnlyList<object> AuditTrail(string environmentId) =>
        _audit.Where(a =>
        {
            var json = JsonSerializer.Serialize(a);
            return json.Contains($"\"env\":\"{environmentId}\"", StringComparison.Ordinal);
        }).ToList();

    private FilterRule? ApplyLayer(FilterLayer layer, FilterRequestContext ctx, string? origin, string? ip)
    {
        foreach (var rule in _rules.Values
                     .Where(r => r.Enabled && r.EnvironmentId == ctx.EnvironmentId && r.Layer == layer)
                     .OrderBy(r => r.Precedence))
        {
            if (rule.AllOf.All(p => Match(p, ctx, origin, ip)))
            {
                return rule;
            }
        }

        return null;
    }

    private static bool Match(FilterPredicate p, FilterRequestContext ctx, string? origin, string? ip)
    {
        string? field = p.Field switch
        {
            FilterField.Origin => origin,
            FilterField.Domain => ctx.Domain ?? TryHost(origin),
            FilterField.ClientIp => ip,
            FilterField.Asn => ctx.AsnStatus is "known" ? ctx.Asn : null,
            FilterField.TrafficClass => ctx.TrafficClass,
            _ => null
        };

        return p.Op switch
        {
            FilterOp.Exists => !string.IsNullOrWhiteSpace(field),
            FilterOp.Equals => string.Equals(field, p.Value, StringComparison.OrdinalIgnoreCase),
            FilterOp.In => p.Values is not null && field is not null
                           && p.Values.Contains(field, StringComparer.OrdinalIgnoreCase),
            FilterOp.CidrContains => ip is not null && p.Value is not null && IpInCidr(ip, p.Value),
            _ => false
        };
    }

    private static string? TryHost(string? origin) =>
        Uri.TryCreate(origin, UriKind.Absolute, out var u) ? u.Host : null;

    private static bool IpInCidr(string ip, string cidr)
    {
        if (!IPAddress.TryParse(ip, out var address))
        {
            return false;
        }

        var parts = cidr.Split('/', 2);
        if (!IPAddress.TryParse(parts[0], out var network))
        {
            return false;
        }

        if (address.AddressFamily != network.AddressFamily)
        {
            return false;
        }

        var prefix = parts.Length == 2 && int.TryParse(parts[1], out var p)
            ? p
            : (network.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork ? 32 : 128);
        var addrBytes = address.GetAddressBytes();
        var netBytes = network.GetAddressBytes();
        var full = prefix / 8;
        var rem = prefix % 8;
        for (var i = 0; i < full; i++)
        {
            if (addrBytes[i] != netBytes[i]) return false;
        }

        if (rem == 0) return true;
        var mask = (byte)~(0xFF >> rem);
        return (addrBytes[full] & mask) == (netBytes[full] & mask);
    }
}
