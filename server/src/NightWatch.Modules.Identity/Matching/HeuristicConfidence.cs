namespace NightWatch.Modules.Identity.Matching;

public sealed record HoldoutBacking(
    string? ActiveModelId,
    double? RocAuc,
    int HoldoutCount);

public sealed record HeuristicConfidenceResult(
    double? Confidence,
    string Status, // calibrated | holdout_backed | heuristic | unavailable
    string Note);

/// <summary>
/// Transparent confidence from match evidence.
/// <c>holdout_backed</c> only when an active feedback model has holdout metrics — never invents calibrated ML.
/// </summary>
public static class HeuristicConfidence
{
    public static HeuristicConfidenceResult Compute(
        string matchType,
        bool continuityValid,
        MatchInsights? insights,
        bool confidenceCalibrated,
        HoldoutBacking? holdout = null)
    {
        if (confidenceCalibrated)
        {
            return new HeuristicConfidenceResult(null, "unavailable", "calibrated_flag_set_but_no_model_registry");
        }

        double score;
        string note;

        if (matchType == "matched" && continuityValid)
        {
            score = 0.92;
            note = "exact_alias_plus_continuity";
        }
        else if (matchType == "matched")
        {
            score = 0.84;
            note = "exact_alias_rematch";
        }
        else if (insights is { Status: "scored", SoftLinked: true, BestScore: not null })
        {
            score = Math.Clamp(0.55 + insights.BestScore.Value * 0.3, 0.55, 0.88);
            note = continuityValid ? "soft_link_with_continuity" : "soft_link_device_vector";
        }
        else if (insights is { Status: "scored", BestScore: not null } && insights.BestDecision == "match")
        {
            score = Math.Clamp(0.45 + insights.BestScore.Value * 0.25, 0.45, 0.75);
            note = "fuzzy_match_no_soft_link";
        }
        else if (matchType == "ambiguous")
        {
            score = 0.4;
            note = "ambiguous_alias_race";
        }
        else if (continuityValid)
        {
            score = 0.5;
            note = "continuity_only_created_visitor";
        }
        else
        {
            return new HeuristicConfidenceResult(null, "unavailable", "insufficient_stability_evidence");
        }

        if (holdout is { ActiveModelId: { Length: > 0 }, RocAuc: >= 0.55, HoldoutCount: >= 2 })
        {
            var auc = holdout.RocAuc!.Value;
            // Blend stability score with holdout quality without claiming production calibration.
            var backed = Math.Clamp(score * (0.88 + 0.12 * auc), 0.35, 0.97);
            return new HeuristicConfidenceResult(
                Math.Round(backed, 3),
                "holdout_backed",
                $"{note}|model={holdout.ActiveModelId}|auc={auc:0.###}|holdout={holdout.HoldoutCount}|not_production_calibrated_ml");
        }

        return new HeuristicConfidenceResult(Math.Round(score, 3), "heuristic", note);
    }
}
