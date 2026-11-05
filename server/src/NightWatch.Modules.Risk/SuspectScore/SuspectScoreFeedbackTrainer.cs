using NightWatch.Modules.Risk.Feedback;

namespace NightWatch.Modules.Risk.SuspectScore;

/// <summary>
/// Turns adjudicated event feedback into transparent heuristic weight updates (not opaque ML).
/// Fraud labels gently amplify high-risk signal weights; legitimate labels dampen them.
/// </summary>
public sealed class SuspectScoreFeedbackTrainer(
    SuspectScoreEngine scores,
    FraudFeedbackPipeline pipeline)
{
    private static readonly string[] Adjustable =
    [
        "browser_bot_detection",
        "ai_agent_detection",
        "browser_automation_agent_detection",
        "remote_access_detection",
        "vpn_detection",
        "proxy_detection",
        "tampered_request_detection",
        "velocity_signals",
        "ip_blocklist_matching"
    ];

    public object Apply(
        string tenantId,
        string caseId,
        string visitorIdHash,
        string label,
        string actor,
        string? notes = null)
    {
        var fraudLabel = label switch
        {
            "fraud" => FraudLabel.ConfirmedFraud,
            "legitimate" => FraudLabel.Legitimate,
            _ => FraudLabel.Unknown
        };

        pipeline.Adjudicate(new FeedbackCase(
            tenantId,
            caseId,
            visitorIdHash,
            DateTimeOffset.UtcNow,
            fraudLabel,
            actor,
            DateTimeOffset.UtcNow,
            notes));

        if (fraudLabel == FraudLabel.Unknown)
        {
            return new { applied = false, reason = "unknown_label_stored_only" };
        }

        var policyTenant = string.IsNullOrWhiteSpace(tenantId) ? "default" : tenantId;
        var current = scores.GetPolicy(policyTenant);
        var factor = fraudLabel == FraudLabel.ConfirmedFraud ? 1.08 : 0.97;
        var nextWeights = new Dictionary<string, double>(current.Weights, StringComparer.Ordinal);
        var changed = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var id in Adjustable)
        {
            if (!nextWeights.TryGetValue(id, out var w)) continue;
            var nw = Math.Clamp(w * factor, 1, 40);
            if (Math.Abs(nw - w) < 0.01) continue;
            nextWeights[id] = Math.Round(nw, 2);
            changed[id] = nextWeights[id];
        }

        var version = $"suspect-score-v1-feedback-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        scores.UpsertPolicy(new TenantScorePolicy(
            policyTenant,
            version,
            current.Mode,
            current.ReviewThreshold,
            current.DenyThreshold,
            nextWeights));

        return new
        {
            applied = true,
            tenantId = policyTenant,
            version,
            factor,
            label = fraudLabel.ToString(),
            changedWeights = changed,
            note = "transparent_heuristic_reweight_not_calibrated_ml"
        };
    }
}
