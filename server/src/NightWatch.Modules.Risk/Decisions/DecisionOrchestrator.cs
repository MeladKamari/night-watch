using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using NightWatch.Modules.Risk.Rules;
using NightWatch.Modules.Risk.SuspectScore;

namespace NightWatch.Modules.Risk.Decisions;

public sealed record DecisionEvaluateRequest(
    string TenantId,
    string BusinessAction,
    string EventId,
    string Nonce,
    int SuspectScore,
    IReadOnlyDictionary<string, object?> Context,
    string? ChallengeReturnUrl);

public sealed record ChallengeTicket(
    string ChallengeId,
    string Kind, // otp | webauthn | manual_review
    DateTimeOffset ExpiresAt,
    string? AllowlistedRedirect);

public sealed record DecisionResponse(
    string AuditId,
    string Action, // observe | allow | log | challenge | manual_review | deny
    IReadOnlyList<string> Reasons,
    string PolicyVersion,
    DateTimeOffset ExpiresAt,
    ChallengeTicket? Challenge,
    bool DefaultObserveOnly);

public sealed class DecisionOrchestrator
{
    private readonly RulesEngine _rules;
    private readonly ConcurrentDictionary<string, string> _nonceSeen = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, DecisionResponse> _challengeResults = new(StringComparer.Ordinal);
    private readonly HashSet<string> _redirectAllowlist;
    private readonly bool _observeOnlyDefault;

    public DecisionOrchestrator(RulesEngine rules, IEnumerable<string>? redirectAllowlist = null, bool observeOnlyDefault = true)
    {
        _rules = rules;
        _redirectAllowlist = new HashSet<string>(redirectAllowlist ?? ["https://app.local/challenge"], StringComparer.OrdinalIgnoreCase);
        _observeOnlyDefault = observeOnlyDefault;
    }

    public DecisionResponse Evaluate(DecisionEvaluateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.TenantId) || string.IsNullOrWhiteSpace(req.EventId) || string.IsNullOrWhiteSpace(req.Nonce))
        {
            return DenyAudit("invalid_request", "none");
        }

        // Idempotent nonce: same tenant|event|nonce returns prior challenge completion if any
        var idem = $"{req.TenantId}|{req.EventId}|{req.Nonce}";
        if (_challengeResults.TryGetValue(idem, out var prior))
        {
            return prior;
        }

        if (!_nonceSeen.TryAdd(idem, req.EventId))
        {
            // replay of evaluate without completed challenge → observe
            return new DecisionResponse(AuditId(idem), "observe", ["nonce_replay"], "none", DateTimeOffset.UtcNow.AddMinutes(5), null, true);
        }

        var facts = new Dictionary<string, object?>(req.Context, StringComparer.Ordinal)
        {
            ["suspect_score"] = req.SuspectScore,
            ["tenant.id"] = req.TenantId,
            ["business_action"] = req.BusinessAction
        };

        var policy = _rules.Evaluate(req.TenantId, facts, simulate: _observeOnlyDefault);
        var action = MapAction(policy.EffectiveAction);
        if (_observeOnlyDefault && action is not "observe" and not "log" and not "allow")
        {
            action = "observe";
        }

        ChallengeTicket? challenge = null;
        if (action is "challenge" or "manual_review" || (!_observeOnlyDefault && policy.EffectiveAction is RuleAction.Challenge or RuleAction.ManualReview))
        {
            var redirect = SanitizeRedirect(req.ChallengeReturnUrl);
            challenge = new ChallengeTicket(
                ChallengeId: Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(idem)))[..16].ToLowerInvariant(),
                Kind: policy.EffectiveAction == RuleAction.ManualReview ? "manual_review" : "otp",
                ExpiresAt: DateTimeOffset.UtcNow.AddMinutes(10),
                AllowlistedRedirect: redirect);
        }

        var resp = new DecisionResponse(
            AuditId(idem),
            action,
            policy.Matches.Select(m => m.Explanation).DefaultIfEmpty("no_rule_match").ToList(),
            policy.Revision,
            DateTimeOffset.UtcNow.AddMinutes(5),
            challenge,
            _observeOnlyDefault);

        return resp;
    }

    /// <summary>Mark challenge completed; forged payloads without known challenge id are rejected.</summary>
    public DecisionResponse CompleteChallenge(string tenantId, string eventId, string nonce, string challengeId, bool success)
    {
        var idem = $"{tenantId}|{eventId}|{nonce}";
        if (!_nonceSeen.ContainsKey(idem))
        {
            return DenyAudit("unknown_challenge_context", "none");
        }

        var expect = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(idem)))[..16].ToLowerInvariant();
        if (!FixedTimeEquals(expect, challengeId))
        {
            return DenyAudit("forged_challenge", "none");
        }

        var action = success ? "allow" : "deny";
        var resp = new DecisionResponse(AuditId(idem + "|done"), action, [success ? "challenge_ok" : "challenge_failed"], "challenge", DateTimeOffset.UtcNow.AddMinutes(5), null, false);
        _challengeResults[idem] = resp;
        return resp;
    }

    private string? SanitizeRedirect(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!_redirectAllowlist.Any(a => url.StartsWith(a, StringComparison.OrdinalIgnoreCase)))
        {
            return null;
        }

        return url;
    }

    private static string MapAction(RuleAction a) => a switch
    {
        RuleAction.Deny => "deny",
        RuleAction.ManualReview => "manual_review",
        RuleAction.Challenge => "challenge",
        RuleAction.Observe => "observe",
        RuleAction.Log => "log",
        _ => "allow"
    };

    private static string AuditId(string material) =>
        "aud_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material)))[..20].ToLowerInvariant();

    private static DecisionResponse DenyAudit(string reason, string version) =>
        new("aud_deny", "deny", [reason], version, DateTimeOffset.UtcNow.AddMinutes(1), null, false);

    private static bool FixedTimeEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
