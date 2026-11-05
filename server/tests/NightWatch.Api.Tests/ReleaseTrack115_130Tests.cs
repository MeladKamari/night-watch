using NightWatch.Modules.Risk.Extra;

namespace NightWatch.Api.Tests;

public class ReleaseTrack115_130Tests
{
    [Fact]
    public void Extra_release_track_services_behave()
    {
        var step = new BankingStepUpOrchestrator();
        Assert.Equal("challenge", step.Plan(50, true).Action);
        Assert.Equal("observe", step.Plan(10, false, vpnAlone: true).Action);
        Assert.NotEqual("deny", step.Plan(10, false, privacyModeAlone: true).Action);

        var trust = new DeviceTrustRegistry();
        var enrolled = DateTimeOffset.UtcNow.AddDays(-2);
        trust.Enroll("t1", "dev1", enrolled);
        Assert.Equal("trusted", trust.Status("t1", "dev1"));
        Assert.True(trust.IsFresh("t1", "dev1", TimeSpan.FromDays(7), enrolled.AddDays(1)));
        Assert.False(trust.IsFresh("t1", "dev1", TimeSpan.FromHours(1), enrolled.AddDays(1)));
        trust.Revoke("t1", "dev1");
        Assert.Equal("revoked", trust.Status("t1", "dev1"));
        Assert.False(trust.IsFresh("t1", "dev1", TimeSpan.FromDays(30)));

        var geo = new OfflineGeoBundleVerifier();
        const string key = "k";
        const string json = "{\"regions\":[]}";
        var sig = Convert.ToHexString(System.Security.Cryptography.HMACSHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(key), System.Text.Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        Assert.True(geo.Verify(json, sig, key));

        var plugins = new CustomSignalPluginHost();
        plugins.Register("t1", new SamplePlugin());
        Assert.Equal("ok", plugins.Evaluate("t1", "sample", new Dictionary<string, string>()));

        var pac = new PolicyAsCodeStore();
        var rev = pac.Publish("t1", "{\"rules\":[]}");
        Assert.Equal(rev, pac.Latest("t1"));

        Assert.True(Math.Abs(new AnomalyMetrics().ZScore([1, 2, 3, 4], 20)) > 1);
        Assert.Contains(new AbSafetyHarness().AssignBucket("v1", "exp1"), new[] { "A", "B" });
        Assert.True(new BenchmarkSuite().Run("noop", () => { }, 50).Passed);

        var dsr = new DataSubjectPortal();
        Assert.StartsWith("dsr_", dsr.FileRequest("t1", "subjhash01", "export"));
        Assert.Contains("fa-IR_rtl", A11yI18nChecklist.Required);
        Assert.False(AirgapSuite.Default().RequiresInternet);
        Assert.Contains("replay_nonce", ThreatTestPlan.Cases);

        var audit = new FeatureCoverageAudit().Audit();
        Assert.Equal(21, audit.WebSignals);
        Assert.Equal(10, audit.DeferredNative);
        Assert.True(audit.ApplePayExcluded);
        Assert.Contains("consent_denied_no_ingest", IranUatScenarios.BankingAndEcommerce);
        Assert.True(ProductionReadiness.DefaultLab().FailoverRunbook);

        var pub = new SignedReleasePublisher();
        var man = "{\"version\":\"1\"}";
        var s = pub.SignManifest(man, "rel-key");
        Assert.True(pub.Verify(man, s, "rel-key"));
        Assert.False(pub.Verify(man, "00", "rel-key"));
    }

    private sealed class SamplePlugin : ICustomSignalPlugin
    {
        public string PluginId => "sample";
        public string Evaluate(IReadOnlyDictionary<string, string> inputs) => "ok";
    }
}
