using NightWatch.Modules.Identity.Matching;

namespace NightWatch.Api.Tests;

public class MatchingEngineTests
{
    [Fact]
    public void Taxonomy_versioned_with_20_plus_counterexamples()
    {
        Assert.Equal("night-watch-taxonomy-v1", EvidenceTaxonomy.Version);
        Assert.True(EvidenceTaxonomy.Entries.Count >= 20);
        Assert.True(EvidenceTaxonomy.MisleadingCounterexamples.Count >= 20);
        Assert.False(EvidenceTaxonomy.IsHardIdentityKey("canvas"));
        Assert.True(EvidenceTaxonomy.IsHardIdentityKey("linkedAccount"));
        Assert.False(EvidenceTaxonomy.IsHardIdentityKey("applePay"));
        Assert.Contains(EvidenceTaxonomy.Entries, e => e.SharedDeviceTrap && e.SignalId == "canvas");
        Assert.Contains(EvidenceTaxonomy.Entries, e => e.KnownUserBindingOnly && e.SignalId == "linkedAccount");
    }

    [Fact]
    public void Equivalent_observations_normalize_identically_missing_not_zero()
    {
        var a = FeatureNormalizer.Normalize(new RawObservation(
            "Win64", "Windows 10", "Chrome 120", "fa-IR,en", 1920, 1080, "ANGLE", "default-v1", null), "ten", "sec");
        var b = FeatureNormalizer.Normalize(new RawObservation(
            "Windows NT", "windows", "Chromium", "fa_IR", 1920, 1080, "ANGLE", "default-v1", null), "ten", "sec");

        Assert.Equal(a.Features.Single(f => f.Key == "os_family").Value, b.Features.Single(f => f.Key == "os_family").Value);
        Assert.Equal("chrome", a.Features.Single(f => f.Key == "browser_family").Value);
        Assert.Equal(a.Features.Single(f => f.Key == "graphics_trait").Value, b.Features.Single(f => f.Key == "graphics_trait").Value);

        var missing = FeatureNormalizer.Normalize(new RawObservation(null, null, null, null, null, null, null, "default-v1", null), "ten", "sec");
        Assert.All(missing.Features, f => Assert.Equal("missing", f.Status));
        Assert.DoesNotContain(missing.Features, f => f.Value == "0");
    }

    [Fact]
    public void Candidate_retrieval_bounded_and_cross_tenant_safe()
    {
        var svc = new CandidateRetrievalService();
        for (var i = 0; i < 100; i++)
        {
            svc.Upsert(new IndexedVisitor
            {
                TenantId = "ten_a",
                VisitorId = $"v_a_{i:D3}",
                BlockKey = "windows|chrome|lxm",
                LshBucket = 7
            });
        }

        svc.Upsert(new IndexedVisitor { TenantId = "ten_b", VisitorId = "v_b_001", BlockKey = "windows|chrome|lxm", ContinuityId = "c_x" });

        var r = svc.Retrieve(new CandidateQuery { TenantId = "ten_a", BlockKey = "windows|chrome|lxm", MaxCandidates = 25 });
        Assert.Equal(25, r.VisitorIds.Count);
        Assert.DoesNotContain(r.VisitorIds, id => id.StartsWith("v_b_"));

        var leak = svc.Retrieve(new CandidateQuery { TenantId = "ten_a", ContinuityId = "c_x" });
        Assert.Empty(leak.VisitorIds);
    }

    [Fact]
    public void Weighted_match_counterexamples()
    {
        var baseA = new Dictionary<string, string?>
        {
            ["os_family"] = "windows",
            ["browser_family"] = "chrome",
            ["locale"] = "fa-ir",
            ["resolution_bucket"] = "lxm",
            ["graphics_trait"] = "abc"
        };

        // Shared workstation identical features without continuity → can be match score but explanation notes; still no calibrated p.
        var shared = WeightedMatcher.Score(baseA, baseA, continuityMatch: false);
        Assert.Equal("unavailable", shared.ConfidenceStatus);
        Assert.Null(shared.CalibratedProbability);

        // OS upgrade incompatibility
        var osUpgrade = WeightedMatcher.Score(baseA, new Dictionary<string, string?>(baseA) { ["os_family"] = "macos" });
        Assert.Equal("no_match", osUpgrade.Decision);

        // Browser update — soft disagree
        var browserUp = WeightedMatcher.Score(baseA, new Dictionary<string, string?>(baseA) { ["browser_family"] = "firefox" });
        Assert.Contains(browserUp.Decision, new[] { "ambiguous", "match", "no_match" });

        // Private mode — missing continuity
        var priv = WeightedMatcher.Score(baseA, baseA, continuityMatch: false);
        Assert.Contains(priv.Evidence, e => e.Key == "continuity" && e.Outcome == "missing");

        // VPN/IP not in feature set — insufficient if only missing network
        var empty = WeightedMatcher.Score(new Dictionary<string, string?>(), new Dictionary<string, string?>());
        Assert.Equal("insufficient_evidence", empty.Decision);
    }
}
