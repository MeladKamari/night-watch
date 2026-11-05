using System.Collections.Concurrent;

namespace NightWatch.Modules.Identity.Matching;

public sealed class CalibrationSample
{
    public required bool SameVisitorLabel { get; init; }
    public required double RawScore { get; init; }
}

public sealed record CalibrationReport(
    string Status, // calibrated | unavailable | insufficient_labels
    double? PrecisionAtThreshold,
    double? RecallAtThreshold,
    int SampleCount,
    double Threshold);

public static class ProbabilityCalibration
{
    public static CalibrationReport Evaluate(IReadOnlyList<CalibrationSample> labeled, double threshold = 0.75)
    {
        if (labeled.Count < 30)
        {
            return new CalibrationReport("insufficient_labels", null, null, labeled.Count, threshold);
        }

        var predictedPos = labeled.Where(s => s.RawScore >= threshold).ToList();
        var truePos = predictedPos.Count(s => s.SameVisitorLabel);
        var actualPos = labeled.Count(s => s.SameVisitorLabel);
        var precision = predictedPos.Count == 0 ? 0 : truePos / (double)predictedPos.Count;
        var recall = actualPos == 0 ? 0 : truePos / (double)actualPos;
        return new CalibrationReport("calibrated", precision, recall, labeled.Count, threshold);
    }
}

public sealed class DriftMonitor
{
    private readonly ConcurrentQueue<double> _scores = new();
    public void Observe(double rawScore) => _scores.Enqueue(rawScore);

    public (string Status, double? Mean) Snapshot(int window = 100)
    {
        var arr = _scores.Reverse().Take(window).ToArray();
        if (arr.Length < 10) return ("insufficient_evidence", null);
        var mean = arr.Average();
        var baseline = 0.5;
        var drift = Math.Abs(mean - baseline);
        return (drift > 0.2 ? "drift_detected" : "stable", mean);
    }
}

public sealed class TrustedDeviceBinding
{
    private readonly ConcurrentDictionary<string, string> _bindings = new(StringComparer.Ordinal);

    public string Bind(string tenantId, string userSubject, string devicePublicKeyThumbprint)
    {
        var id = $"td_{tenantId}_{Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(userSubject + devicePublicKeyThumbprint))).ToLowerInvariant()[..12]}";
        _bindings[$"{tenantId}|{userSubject}"] = id;
        return id;
    }

    public bool Verify(string tenantId, string userSubject, string expectedBindingId) =>
        _bindings.TryGetValue($"{tenantId}|{userSubject}", out var id) && id == expectedBindingId;
}

public sealed class CrossBrowserLinkPolicy
{
    public const int MaxLinksPerVisitor = 3;

    public bool AllowLink(int existingLinks, bool sameTenant, bool userConsented) =>
        sameTenant && userConsented && existingLinks < MaxLinksPerVisitor;
}

public sealed class CandidateLockManager
{
    private readonly ConcurrentDictionary<string, byte> _locks = new(StringComparer.Ordinal);

    public bool TryLock(string tenantId, string visitorId, out string lockId)
    {
        lockId = $"{tenantId}:{visitorId}";
        return _locks.TryAdd(lockId, 1);
    }

    public void Unlock(string lockId) => _locks.TryRemove(lockId, out _);
}

public sealed class ReviewCase
{
    public required string CaseId { get; init; }
    public required string TenantId { get; init; }
    public required string Status { get; set; } // open | resolved | disputed
    public string? Resolution { get; set; }
}

public sealed class HumanReviewWorkflow
{
    private readonly ConcurrentDictionary<string, ReviewCase> _cases = new(StringComparer.Ordinal);

    public ReviewCase Open(string tenantId, string reason)
    {
        var c = new ReviewCase { CaseId = "rv_" + Guid.NewGuid().ToString("N")[..8], TenantId = tenantId, Status = "open", Resolution = reason };
        _cases[c.CaseId] = c;
        return c;
    }

    public bool Resolve(string caseId, string resolution)
    {
        if (!_cases.TryGetValue(caseId, out var c) || c.Status != "open") return false;
        c.Status = "resolved";
        c.Resolution = resolution;
        return true;
    }

    public bool Dispute(string caseId)
    {
        if (!_cases.TryGetValue(caseId, out var c)) return false;
        c.Status = "disputed";
        return true;
    }
}

public static class RiskIdentitySeparation
{
    /// <summary>Regression: risk score must not rewrite visitorId assignment.</summary>
    public static bool AssignmentIgnoresRisk(string visitorIdBefore, string visitorIdAfter, double riskScore) =>
        visitorIdBefore == visitorIdAfter && riskScore is >= 0 and <= 1;
}
