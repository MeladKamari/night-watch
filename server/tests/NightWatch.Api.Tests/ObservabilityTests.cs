using NightWatch.BuildingBlocks.Observability;

namespace NightWatch.Api.Tests;

public class ObservabilityTests
{
    [Fact]
    public void Trace_pipeline_has_no_pii_leak()
    {
        var metrics = new ProPlusMetrics();
        var trace = new PipelineTrace();
        trace.RunIngestMatchRiskWebhook("corr_abc123", metrics);

        Assert.Equal(new[] { "ingest", "match", "risk", "webhook" }, trace.Spans);
        Assert.All(trace.LogLines, line => Assert.False(LogSanitizer.ContainsRawFingerprintLeak(line), line));
        Assert.Contains("canvas=[redacted]", trace.LogLines[0]);
        Assert.Contains("visitorId=[redacted]", trace.LogLines[0]);

        var snap = metrics.Snapshot();
        Assert.NotNull(snap);
    }
}
