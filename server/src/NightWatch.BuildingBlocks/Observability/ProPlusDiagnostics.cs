using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace NightWatch.BuildingBlocks.Observability;

public static class ProPlusActivitySources
{
    public static readonly ActivitySource Root = new("NightWatch");
}

public sealed class ProPlusMetrics
{
    private long _ingestFailures;
    private long _matchAmbiguities;
    private long _webhookLagMsSum;
    private long _webhookLagSamples;
    private long _signalUnknown;
    private long _signalTotal;
    private long _redisHits;
    private long _redisMisses;
    private long _datasetStale;

    public void RecordApiLatency(string route, double ms) =>
        LastLatencies[route] = ms;

    public ConcurrentDictionary<string, double> LastLatencies { get; } = new(StringComparer.Ordinal);

    public void IngestFailure() => Interlocked.Increment(ref _ingestFailures);
    public void MatchAmbiguity() => Interlocked.Increment(ref _matchAmbiguities);
    public void WebhookLag(long ms)
    {
        Interlocked.Add(ref _webhookLagMsSum, ms);
        Interlocked.Increment(ref _webhookLagSamples);
    }

    public void Signal(bool unknown)
    {
        Interlocked.Increment(ref _signalTotal);
        if (unknown) Interlocked.Increment(ref _signalUnknown);
    }

    public void Redis(bool hit)
    {
        if (hit) Interlocked.Increment(ref _redisHits);
        else Interlocked.Increment(ref _redisMisses);
    }

    public void DatasetStale() => Interlocked.Increment(ref _datasetStale);

    public object Snapshot() => new
    {
        ingestFailures = Interlocked.Read(ref _ingestFailures),
        matchAmbiguities = Interlocked.Read(ref _matchAmbiguities),
        webhookLagMsAvg = Interlocked.Read(ref _webhookLagSamples) == 0
            ? 0
            : Interlocked.Read(ref _webhookLagMsSum) / (double)Interlocked.Read(ref _webhookLagSamples),
        signalUnknownRate = Interlocked.Read(ref _signalTotal) == 0
            ? 0
            : Interlocked.Read(ref _signalUnknown) / (double)Interlocked.Read(ref _signalTotal),
        redisHitRatio = (Interlocked.Read(ref _redisHits) + Interlocked.Read(ref _redisMisses)) == 0
            ? 0
            : Interlocked.Read(ref _redisHits) / (double)(Interlocked.Read(ref _redisHits) + Interlocked.Read(ref _redisMisses)),
        datasetStalenessCount = Interlocked.Read(ref _datasetStale),
        latencies = LastLatencies
    };
}

public static class LogSanitizer
{
    private static readonly Regex Hex32 = new("\\b[0-9a-f]{32}\\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly string[] ForbiddenKeys = ["canvas", "audio", "fingerprint", "visitorId", "rawComponents"];

    public static string Sanitize(string message)
    {
        var s = message;
        foreach (var k in ForbiddenKeys)
        {
            s = Regex.Replace(s, $"{k}\\s*[:=]\\s*[^\\s,;]+", $"{k}=[redacted]", RegexOptions.IgnoreCase);
        }

        return Hex32.Replace(s, "[redacted_hash]");
    }

    public static bool ContainsRawFingerprintLeak(string message) =>
        ForbiddenKeys.Any(k => Regex.IsMatch(message, $"{k}\\s*[:=]\\s*(?!\\[redacted\\])\\S+", RegexOptions.IgnoreCase))
        || Hex32.IsMatch(message);
}

public sealed class PipelineTrace
{
    public List<string> Spans { get; } = [];
    public List<string> LogLines { get; } = [];

    public void RunIngestMatchRiskWebhook(string correlationId, ProPlusMetrics metrics)
    {
        using var root = ProPlusActivitySources.Root.StartActivity("ingest_to_webhook");
        root?.SetTag("correlation.id", correlationId);

        void Span(string name, Action a)
        {
            using var child = ProPlusActivitySources.Root.StartActivity(name);
            child?.SetTag("correlation.id", correlationId);
            Spans.Add(name);
            a();
        }

        Span("ingest", () =>
        {
            metrics.RecordApiLatency("ingest", 12);
            LogLines.Add(LogSanitizer.Sanitize($"ingest ok correlation={correlationId} canvas=rawdata_should_go visitorId=c5e055512be85b8798fe5d3240b2a04e"));
        });
        Span("match", () =>
        {
            metrics.MatchAmbiguity();
            LogLines.Add(LogSanitizer.Sanitize($"match ambiguous correlation={correlationId}"));
        });
        Span("risk", () =>
        {
            metrics.Signal(unknown: true);
            LogLines.Add(LogSanitizer.Sanitize($"risk unknown_rate bump correlation={correlationId}"));
        });
        Span("webhook", () =>
        {
            metrics.WebhookLag(40);
            LogLines.Add(LogSanitizer.Sanitize($"webhook queued correlation={correlationId}"));
        });
    }
}
