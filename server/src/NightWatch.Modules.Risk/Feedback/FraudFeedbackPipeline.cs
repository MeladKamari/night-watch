namespace NightWatch.Modules.Risk.Feedback;

public enum FraudLabel
{
    ConfirmedFraud,
    Legitimate,
    Unknown
}

public sealed record FeedbackCase(
    string TenantId,
    string CaseId,
    string VisitorIdHash,
    DateTimeOffset EventAt,
    FraudLabel Label,
    string Adjudicator,
    DateTimeOffset LabeledAt,
    string? Notes);

public sealed record ModelRegistryEntry(
    string ModelId,
    string Version,
    DateTimeOffset RegisteredAt,
    string Status, // candidate | active | rolled_back
    IReadOnlyDictionary<string, double> Metrics);

public sealed record HoldoutSplit(
    IReadOnlyList<FeedbackCase> Train,
    IReadOnlyList<FeedbackCase> Holdout);

public sealed record EvaluationReport(
    string ModelVersion,
    int TrainCount,
    int HoldoutCount,
    double? RocAuc,
    double? AveragePrecision,
    double? CalibrationError,
    IReadOnlyList<string> LeakageWarnings,
    string DatasetKind); // synthetic | real

/// <summary>
/// Responsible labeling + evaluation harness. No consentless PII; synthetic metrics when only synthetic labels exist.
/// </summary>
public sealed class FraudFeedbackPipeline
{
    private readonly List<FeedbackCase> _cases = new();
    private readonly Dictionary<string, ModelRegistryEntry> _models = new(StringComparer.Ordinal);
    private string? _activeModelId;

    public void Adjudicate(FeedbackCase feedback)
    {
        if (string.IsNullOrWhiteSpace(feedback.TenantId) || string.IsNullOrWhiteSpace(feedback.CaseId))
        {
            throw new ArgumentException("tenant and case required");
        }

        if (LooksLikeRawPii(feedback.VisitorIdHash) || LooksLikeRawPii(feedback.Notes))
        {
            throw new InvalidOperationException("consentless_raw_pii_rejected");
        }

        _cases.RemoveAll(c => c.TenantId == feedback.TenantId && c.CaseId == feedback.CaseId);
        _cases.Add(feedback);
    }

    public IReadOnlyList<FeedbackCase> List(string tenantId) =>
        _cases.Where(c => c.TenantId == tenantId).OrderBy(c => c.EventAt).ToList();

    public HoldoutSplit TemporalHoldout(string tenantId, double holdoutFraction = 0.2)
    {
        var ordered = List(tenantId).Where(c => c.Label != FraudLabel.Unknown).ToList();
        if (ordered.Count == 0)
        {
            return new HoldoutSplit([], []);
        }

        var cut = Math.Max(1, (int)Math.Floor(ordered.Count * (1 - holdoutFraction)));
        if (cut >= ordered.Count) cut = ordered.Count - 1;
        return new HoldoutSplit(ordered.Take(cut).ToList(), ordered.Skip(cut).ToList());
    }

    public EvaluationReport EvaluateSyntheticBaseline(string tenantId, string modelVersion)
    {
        var split = TemporalHoldout(tenantId);
        var leakage = new List<string>();
        if (split.Train.Select(t => t.CaseId).Intersect(split.Holdout.Select(h => h.CaseId)).Any())
        {
            leakage.Add("case_id_overlap");
        }

        // Temporal leakage: holdout event earlier than train max
        if (split.Train.Count > 0 && split.Holdout.Count > 0)
        {
            var trainMax = split.Train.Max(t => t.EventAt);
            if (split.Holdout.Any(h => h.EventAt < trainMax))
            {
                leakage.Add("temporal_leakage");
            }
        }

        var holdoutLabels = split.Holdout.Select(h => h.Label == FraudLabel.ConfirmedFraud ? 1 : 0).ToList();
        var scores = split.Holdout.Select(h => HeuristicScore(h)).ToList();

        double? roc = holdoutLabels.Count >= 2 && holdoutLabels.Distinct().Count() > 1
            ? ApproximateAuc(scores, holdoutLabels)
            : null;
        double? ap = holdoutLabels.Count >= 1 ? ApproximateAveragePrecision(scores, holdoutLabels) : null;
        double? cal = holdoutLabels.Count >= 1 ? CalibrationMae(scores, holdoutLabels) : null;

        var entry = new ModelRegistryEntry(modelVersion, modelVersion, DateTimeOffset.UtcNow, "candidate",
            new Dictionary<string, double>
            {
                ["roc_auc"] = roc ?? double.NaN,
                ["average_precision"] = ap ?? double.NaN,
                ["calibration_mae"] = cal ?? double.NaN
            });
        _models[modelVersion] = entry;

        return new EvaluationReport(modelVersion, split.Train.Count, split.Holdout.Count, roc, ap, cal, leakage, "synthetic");
    }

    public void Activate(string modelId)
    {
        if (!_models.TryGetValue(modelId, out var m))
        {
            throw new InvalidOperationException("model_not_registered");
        }

        _models[modelId] = m with { Status = "active" };
        if (_activeModelId is not null && _models.TryGetValue(_activeModelId, out var prev) && prev.Status == "active")
        {
            _models[_activeModelId] = prev with { Status = "rolled_back" };
        }

        _activeModelId = modelId;
    }

    public void Rollback(string modelId)
    {
        if (!_models.TryGetValue(modelId, out var m))
        {
            throw new InvalidOperationException("model_not_registered");
        }

        _models[modelId] = m with { Status = "rolled_back" };
        if (_activeModelId == modelId) _activeModelId = null;
    }

    public string? ActiveModelId => _activeModelId;

    public ModelRegistryEntry? GetModel(string modelId) =>
        _models.TryGetValue(modelId, out var m) ? m : null;

    private static double HeuristicScore(FeedbackCase c) =>
        c.Label == FraudLabel.ConfirmedFraud ? 0.8 : 0.2;

    private static bool LooksLikeRawPii(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        // Reject obvious emails / phone-like raw identifiers in notes or visitor fields
        return text.Contains('@') || text.Any(char.IsWhiteSpace) && text.Any(char.IsDigit) && text.Length > 8 && text.Count(char.IsDigit) >= 8;
    }

    private static double ApproximateAuc(IReadOnlyList<double> scores, IReadOnlyList<int> labels)
    {
        var pairs = scores.Zip(labels).OrderByDescending(x => x.First).ToList();
        double tp = 0, fp = 0;
        var positives = labels.Count(l => l == 1);
        var negatives = labels.Count - positives;
        if (positives == 0 || negatives == 0) return double.NaN;
        double auc = 0;
        double prevScore = double.PositiveInfinity;
        double prevTp = 0, prevFp = 0;
        foreach (var (score, label) in pairs)
        {
            if (score != prevScore)
            {
                auc += Trapezoid(prevFp / negatives, fp / negatives, prevTp / positives, tp / positives);
                prevScore = score;
                prevTp = tp;
                prevFp = fp;
            }

            if (label == 1) tp++;
            else fp++;
        }

        auc += Trapezoid(prevFp / negatives, fp / negatives, prevTp / positives, tp / positives);
        return auc;
    }

    private static double Trapezoid(double x0, double x1, double y0, double y1) =>
        (x1 - x0) * (y0 + y1) / 2.0;

    private static double ApproximateAveragePrecision(IReadOnlyList<double> scores, IReadOnlyList<int> labels)
    {
        var ordered = scores.Zip(labels).OrderByDescending(x => x.First).ToList();
        double hits = 0, sum = 0;
        for (var i = 0; i < ordered.Count; i++)
        {
            if (ordered[i].Second != 1) continue;
            hits++;
            sum += hits / (i + 1);
        }

        var positives = labels.Count(l => l == 1);
        return positives == 0 ? 0 : sum / positives;
    }

    private static double CalibrationMae(IReadOnlyList<double> scores, IReadOnlyList<int> labels)
    {
        if (scores.Count == 0) return double.NaN;
        return scores.Zip(labels).Average(z => Math.Abs(z.First - z.Second));
    }
}
