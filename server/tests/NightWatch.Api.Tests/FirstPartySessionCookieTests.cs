using NightWatch.Modules.Identity;

namespace NightWatch.Api.Tests;

public class FirstPartySessionCookieTests
{
    [Fact]
    public void Tampering_and_cross_project_replay_rejected()
    {
        var svc = new FirstPartySessionCookieService();
        var issued = svc.Issue(new SessionCookieIssueRequest(
            "ten_a",
            "prj_web",
            "fraud_prevention",
            "legitimate_interest"));
        Assert.NotNull(issued);
        Assert.True(issued!.HttpOnly);
        Assert.True(issued.Secure);
        Assert.Equal("Lax", issued.SameSite);
        Assert.Equal("__Host-ibf_sid", issued.Name);
        Assert.Null(issued.Domain);

        var ok = svc.Validate(issued.Value, "prj_web");
        Assert.True(ok.Valid);
        Assert.Equal("no_claim_across_private_mode_cookie_clear_or_unrelated_browsers", ok.ContinuityClaim);

        var parts = issued.Value.Split('.', 3);
        var tampered = $"{parts[0]}.{parts[1]}.{parts[2][..^2]}aa";
        Assert.Equal("tampered", svc.Validate(tampered, "prj_web").Code);

        Assert.Equal("cross_project_replay", svc.Validate(issued.Value, "prj_other").Code);

        Assert.Null(svc.Issue(new SessionCookieIssueRequest("ten_a", "prj_web", "marketing", "consent")));

        Assert.True(svc.Revoke(ok.ContinuityId!));
        Assert.Equal("revoked", svc.Validate(issued.Value, "prj_web").Code);
    }
}
