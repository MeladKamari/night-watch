using NightWatch.Modules.Identity.Matching;

namespace NightWatch.Api.Tests;

public class CalibrationAndOpsTests
{
    [Fact]
    public void Calibration_drift_trusted_device_cross_browser_locks_review_separation()
    {
        Assert.Equal("insufficient_labels", ProbabilityCalibration.Evaluate([]).Status);
        var labeled = Enumerable.Range(0, 40).Select(i => new CalibrationSample
        {
            SameVisitorLabel = i % 2 == 0,
            RawScore = i % 2 == 0 ? 0.9 : 0.2
        }).ToList();
        var report = ProbabilityCalibration.Evaluate(labeled);
        Assert.Equal("calibrated", report.Status);
        Assert.NotNull(report.PrecisionAtThreshold);

        var drift = new DriftMonitor();
        for (var i = 0; i < 20; i++) drift.Observe(0.9);
        Assert.Equal("drift_detected", drift.Snapshot().Status);

        var td = new TrustedDeviceBinding();
        var id = td.Bind("ten", "user1", "thumb");
        Assert.True(td.Verify("ten", "user1", id));

        Assert.False(new CrossBrowserLinkPolicy().AllowLink(3, true, true));
        Assert.True(new CrossBrowserLinkPolicy().AllowLink(1, true, true));

        var locks = new CandidateLockManager();
        Assert.True(locks.TryLock("ten", "v1", out var lid));
        Assert.False(locks.TryLock("ten", "v1", out _));
        locks.Unlock(lid);
        Assert.True(locks.TryLock("ten", "v1", out _));

        var wf = new HumanReviewWorkflow();
        var c = wf.Open("ten", "ambiguous_merge");
        Assert.True(wf.Resolve(c.CaseId, "keep_split"));
        Assert.True(wf.Dispute(c.CaseId));

        Assert.True(RiskIdentitySeparation.AssignmentIgnoresRisk("v_a", "v_a", 0.99));
        Assert.False(RiskIdentitySeparation.AssignmentIgnoresRisk("v_a", "v_b", 0.1));
    }
}
