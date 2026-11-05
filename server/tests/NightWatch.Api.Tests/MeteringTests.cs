using NightWatch.Modules.Reporting;

namespace NightWatch.Api.Tests;

public class MeteringTests
{
    [Fact]
    public void Metered_usage_reconciles_with_retries()
    {
        var m = new MeteringService();
        m.ProvisionQuota("ten_m", "prj", "env", 2, freeTrial: true);

        Assert.True(m.TryAcceptIngest("ten_m", "prj", "env", "ev1").Accepted);
        Assert.True(m.TryAcceptIngest("ten_m", "prj", "env", "ev2").Accepted);
        var over = m.TryAcceptIngest("ten_m", "prj", "env", "ev3");
        Assert.False(over.Accepted);
        Assert.Equal("quota_exceeded", over.Code);

        var retry = m.TryAcceptIngest("ten_m", "prj", "env", "ev1");
        Assert.True(retry.Accepted);
        Assert.True(retry.AlreadyAcceptedPreserved);
        Assert.Equal(2, m.GetUsage("ten_m", "prj", "env"));

        var csv = m.ExportInvoiceCsv("ten_m", "prj", "env", "2026-11");
        Assert.Contains("none_self_hosted", csv);
        Assert.Contains("True", csv); // freeTrial
    }
}
