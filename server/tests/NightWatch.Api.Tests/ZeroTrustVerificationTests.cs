using NightWatch.Modules.Identity;

namespace NightWatch.Api.Tests;

public class ZeroTrustVerificationTests
{
    [Fact]
    public void Forged_visitorId_and_replayed_receipt_cannot_approve()
    {
        var zt = new ZeroTrustVerificationService();
        var opaque = zt.ToBrowserOpaque("ev_zt_1");
        Assert.Equal("ev_zt_1", opaque.EventId);
        Assert.Contains("opaque", opaque.Mode);

        var verified = zt.IssueVerifiedEvent("ev_zt_1", "v_real", "ten_a", "prj_web", "created");

        var forged = zt.EvaluateProtectedTransaction(
            browserClaimedVisitorId: "v_forged_by_browser",
            eventReceipt: "zt1.fake.sig",
            expectedProjectId: "prj_web",
            businessAction: "checkout",
            amount: 1000m);
        Assert.False(forged.Approved);
        Assert.Equal("deny", forged.Decision);

        var highValue = zt.EvaluateProtectedTransaction(
            "v_forged_by_browser",
            verified.Receipt,
            "prj_web",
            "checkout",
            600_000m);
        Assert.False(highValue.Approved);
        Assert.Equal("step_up", highValue.Decision);

        var ok = zt.EvaluateProtectedTransaction(
            "v_forged_ignored",
            verified.Receipt,
            "prj_web",
            "checkout",
            1000m);
        Assert.True(ok.Approved);
        Assert.Equal("allow_conditional", ok.Decision);

        var replay = zt.EvaluateProtectedTransaction(
            "v_forged_ignored",
            verified.Receipt,
            "prj_web",
            "checkout",
            1000m);
        Assert.False(replay.Approved);
        Assert.Equal("receipt_replay", replay.Reason);
    }
}
