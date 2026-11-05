namespace NightWatch.Modules.Identity.Matching;

public sealed record FeatureWeight(string Key, double Weight, bool IncompatibleIfDifferent);

public sealed record MatchExplanation(string Key, string Outcome, double Contribution, string? Note);

public sealed record MatchScoreResult(
    double RawScore,
    string Decision, // match | ambiguous | no_match | insufficient_evidence
    string ConfidenceStatus, // unavailable | calibrated
    double? CalibratedProbability,
    IReadOnlyList<MatchExplanation> Evidence);

public static class WeightedMatcher
{
    public static readonly IReadOnlyList<FeatureWeight> DefaultWeights =
    [
        new("os_family", 1.0, true),
        new("browser_family", 0.8, false),
        new("locale", 0.4, false),
        new("resolution_bucket", 0.5, false),
        new("graphics_trait", 1.2, false),
        new("continuity", 2.0, false)
    ];

    public static MatchScoreResult Score(
        IReadOnlyDictionary<string, string?> a,
        IReadOnlyDictionary<string, string?> b,
        DateTimeOffset? observedAt = null,
        DateTimeOffset? priorAt = null,
        bool continuityMatch = false)
    {
        var evidence = new List<MatchExplanation>();
        double score = 0;
        double possible = 0;
        var compared = 0;

        foreach (var w in DefaultWeights)
        {
            if (w.Key == "continuity")
            {
                // Missing continuity is not evidence against a match — only boost when present.
                if (continuityMatch)
                {
                    possible += w.Weight;
                    score += w.Weight;
                    evidence.Add(new MatchExplanation("continuity", "agree", w.Weight, null));
                }
                else
                {
                    evidence.Add(new MatchExplanation("continuity", "missing", 0, "no_continuity_token"));
                }

                continue;
            }

            a.TryGetValue(w.Key, out var va);
            b.TryGetValue(w.Key, out var vb);
            if (va is null || vb is null)
            {
                evidence.Add(new MatchExplanation(w.Key, "missing", 0, "missing_not_zero"));
                continue;
            }

            compared++;
            possible += w.Weight;
            if (string.Equals(va, vb, StringComparison.Ordinal))
            {
                score += w.Weight;
                evidence.Add(new MatchExplanation(w.Key, "agree", w.Weight, null));
            }
            else if (w.IncompatibleIfDifferent)
            {
                score -= w.Weight * 2;
                evidence.Add(new MatchExplanation(w.Key, "incompatible", -w.Weight * 2, "hard_incompatibility"));
            }
            else
            {
                evidence.Add(new MatchExplanation(w.Key, "disagree", 0, null));
            }
        }

        // Time decay on positive score only.
        if (observedAt is not null && priorAt is not null && score > 0)
        {
            var days = Math.Abs((observedAt.Value - priorAt.Value).TotalDays);
            var decay = Math.Exp(-days / 180.0);
            score *= decay;
            evidence.Add(new MatchExplanation("time_decay", "applied", score, $"days={days:0}"));
        }

        if (compared == 0 && !continuityMatch)
        {
            return new MatchScoreResult(0, "insufficient_evidence", "unavailable", null, evidence);
        }

        var ratio = possible <= 0 ? 0 : score / possible;
        var decision = ratio >= 0.75 ? "match" : ratio >= 0.4 ? "ambiguous" : "no_match";

        // Never invent calibrated probability without labeled longitudinal samples.
        return new MatchScoreResult(ratio, decision, "unavailable", null, evidence);
    }
}
