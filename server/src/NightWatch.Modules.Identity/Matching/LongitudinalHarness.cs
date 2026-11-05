namespace NightWatch.Modules.Identity.Matching;

/// <summary>Controlled longitudinal scenarios for browser/OS updates (STEP 041).</summary>
public static class LongitudinalHarness
{
    public static MatchScoreResult SimulateBrowserUpdate()
    {
        var before = new Dictionary<string, string?>
        {
            ["os_family"] = "windows",
            ["browser_family"] = "chrome",
            ["graphics_trait"] = "g1",
            ["locale"] = "fa-ir",
            ["resolution_bucket"] = "lxm"
        };
        var after = new Dictionary<string, string?>(before) { ["browser_family"] = "chrome" /* same family */, ["graphics_trait"] = "g1b" };
        return WeightedMatcher.Score(before, after, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(-7));
    }

    public static MatchScoreResult SimulateOsUpgrade()
    {
        var before = new Dictionary<string, string?> { ["os_family"] = "windows", ["browser_family"] = "chrome", ["graphics_trait"] = "g1" };
        var after = new Dictionary<string, string?> { ["os_family"] = "macos", ["browser_family"] = "chrome", ["graphics_trait"] = "g1" };
        return WeightedMatcher.Score(before, after);
    }

    public static MatchScoreResult SimulateStableSameDevice()
    {
        var v = new Dictionary<string, string?>
        {
            ["os_family"] = "windows",
            ["browser_family"] = "chrome",
            ["graphics_trait"] = "g1",
            ["locale"] = "fa-ir",
            ["resolution_bucket"] = "lxm"
        };
        return WeightedMatcher.Score(v, new Dictionary<string, string?>(v), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(-1), continuityMatch: true);
    }

    public static MatchScoreResult SimulateLocaleDrift()
    {
        var before = new Dictionary<string, string?>
        {
            ["os_family"] = "windows",
            ["browser_family"] = "chrome",
            ["graphics_trait"] = "g1",
            ["locale"] = "fa-ir",
            ["resolution_bucket"] = "lxm"
        };
        var after = new Dictionary<string, string?>(before) { ["locale"] = "en-us" };
        return WeightedMatcher.Score(before, after, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(-2));
    }
}
