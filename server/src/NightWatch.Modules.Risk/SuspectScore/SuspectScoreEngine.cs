using NightWatch.Modules.Risk.SmartSignals;

namespace NightWatch.Modules.Risk.SuspectScore;

public sealed record ScoreContribution(
    string SignalId,
    double Weight,
    double AppliedPoints,
    DetectionTriState TriState,
    string Kind, // heuristic | calibrated_ml
    string? ReasonCode);

public sealed record SuspectScoreResult(
    string TenantId,
    string Version,
    int Score,
    string Decision, // allow | review | deny | shadow
    string Mode, // enforce | shadow | calibration
    IReadOnlyList<ScoreContribution> Contributions,
    IReadOnlyList<string> UnknownSignals,
    IReadOnlyList<string> ReasonCodes,
    string ScoreKind, // heuristic_weighted (never claim calibrated ML without registry)
    IReadOnlyDictionary<string, int>? Facets = null);

public sealed record TenantScorePolicy(
    string TenantId,
    string Version,
    string Mode, // enforce | shadow | calibration
    int ReviewThreshold,
    int DenyThreshold,
    IReadOnlyDictionary<string, double> Weights);

public sealed class SuspectScoreEngine
{
    public const string BaselineVersion = "suspect-score-v1-heuristic";

    private static readonly IReadOnlyDictionary<string, double> DefaultWeights =
        new Dictionary<string, double>(StringComparer.Ordinal)
        {
            ["browser_bot_detection"] = 25,
            ["ai_agent_detection"] = 15,
            ["browser_automation_agent_detection"] = 18,
            ["remote_access_detection"] = 14,
            ["high_activity_device"] = 10,
            ["virtual_machine_detection"] = 8,
            ["browser_tamper_detection"] = 12,
            ["anti_detect_browser_detection"] = 10,
            ["tampered_request_detection"] = 20,
            ["mitm_attack_detection"] = 12,
            ["vpn_detection"] = 5,
            ["proxy_detection"] = 5,
            ["incognito_detection"] = 2,
            ["privacy_focused_browser_detection"] = 3,
            ["velocity_signals"] = 10,
            ["ip_blocklist_matching"] = 15,
            ["rare_device_detection"] = 8,
            ["proximity_detection"] = 14
        };

    private readonly ConcurrentPolicyStore _policies = new();

    public SuspectScoreEngine()
    {
        // Default tenant policy
        _policies.Upsert(new TenantScorePolicy(
            "default",
            BaselineVersion,
            "enforce",
            ReviewThreshold: 40,
            DenyThreshold: 70,
            DefaultWeights));
    }

    public void UpsertPolicy(TenantScorePolicy policy) => _policies.Upsert(policy);

    public TenantScorePolicy GetPolicy(string tenantId) =>
        _policies.TryGet(tenantId, out var p) ? p : _policies.GetRequired("default");

    public SuspectScoreResult Score(string tenantId, IReadOnlyList<UnifiedSignalOutcome> outcomes)
    {
        var policy = GetPolicy(tenantId);
        var contributions = new List<ScoreContribution>();
        var unknown = new List<string>();
        var reasons = new List<string>();
        double raw = 0;

        foreach (var o in outcomes)
        {
            if (!policy.Weights.TryGetValue(o.SignalId, out var weight))
            {
                continue;
            }

            if (o.TriState == DetectionTriState.Unknown ||
                o.Status is "unknown" or "unavailable" or "unsupported" or "error" or "not_applicable")
            {
                unknown.Add(o.SignalId);
                contributions.Add(new ScoreContribution(o.SignalId, weight, 0, DetectionTriState.Unknown, "heuristic", "unknown_no_points"));
                continue;
            }

            if (o.TriState == DetectionTriState.NotDetected)
            {
                contributions.Add(new ScoreContribution(o.SignalId, weight, 0, DetectionTriState.NotDetected, "heuristic", "clean_signal"));
                continue;
            }

            // Detected → apply full weight (transparent heuristic; not calibrated ML)
            raw += weight;
            var code = $"detected:{o.SignalId}";
            reasons.Add(code);
            contributions.Add(new ScoreContribution(o.SignalId, weight, weight, DetectionTriState.Detected, "heuristic", code));
        }

        var score = (int)Math.Clamp(Math.Round(raw), 0, 100);
        var decision = ResolveDecision(score, policy);

        if (unknown.Count > 0)
        {
            reasons.Add($"unknown_count={unknown.Count}");
        }

        reasons.Add($"version={policy.Version}");
        reasons.Add($"kind=heuristic_weighted");

        return new SuspectScoreResult(
            tenantId,
            policy.Version,
            score,
            decision,
            policy.Mode,
            contributions,
            unknown,
            reasons,
            ScoreKind: "heuristic_weighted",
            Facets: BuildFacets(contributions));
    }

    /// <summary>
    /// Derived UEBA-style facets over existing contributions (not a separate ML model).
    /// </summary>
    public static IReadOnlyDictionary<string, int> BuildFacets(IReadOnlyList<ScoreContribution> contributions)
    {
        var map = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal)
        {
            ["humanity"] = new(StringComparer.Ordinal)
            {
                "browser_bot_detection", "ai_agent_detection", "browser_automation_agent_detection"
            },
            ["authenticity"] = new(StringComparer.Ordinal)
            {
                "browser_tamper_detection", "anti_detect_browser_detection", "tampered_request_detection",
                "mitm_attack_detection", "virtual_machine_detection", "remote_access_detection"
            },
            ["uniqueness"] = new(StringComparer.Ordinal)
            {
                "rare_device_detection", "high_activity_device", "velocity_signals", "ip_blocklist_matching"
            },
            ["behavior"] = new(StringComparer.Ordinal)
            {
                "vpn_detection", "proxy_detection", "incognito_detection", "privacy_focused_browser_detection",
                "proximity_detection"
            }
        };

        var facets = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (facet, ids) in map)
        {
            var points = contributions
                .Where(c => ids.Contains(c.SignalId) && c.AppliedPoints > 0)
                .Sum(c => c.AppliedPoints);
            facets[facet] = (int)Math.Clamp(Math.Round(points), 0, 100);
        }

        return facets;
    }

    private static string ResolveDecision(int score, TenantScorePolicy policy)
    {
        if (policy.Mode == "shadow")
        {
            return "shadow";
        }

        if (score >= policy.DenyThreshold) return "deny";
        if (score >= policy.ReviewThreshold) return "review";
        return "allow";
    }

    private sealed class ConcurrentPolicyStore
    {
        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, TenantScorePolicy> _map =
            new(StringComparer.Ordinal);

        public void Upsert(TenantScorePolicy policy) => _map[policy.TenantId] = policy;

        public bool TryGet(string tenantId, out TenantScorePolicy policy) => _map.TryGetValue(tenantId, out policy!);

        public TenantScorePolicy GetRequired(string tenantId) =>
            _map.TryGetValue(tenantId, out var p) ? p : throw new InvalidOperationException($"missing policy {tenantId}");
    }
}
