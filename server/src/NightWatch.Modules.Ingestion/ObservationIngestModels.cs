namespace NightWatch.Modules.Ingestion;

public sealed class ObservationIngestRequest
{
    public string? SchemaVersion { get; set; }
    public string? ProductCode { get; set; }
    public string? ProcessingVersion { get; set; }
    public string? IdentityAlgorithmVersion { get; set; }
    public string? Purpose { get; set; }
    public string? ConsentStatus { get; set; }
    public string? CollectedAt { get; set; }
    public string? IdempotencyKey { get; set; }
    public string? Nonce { get; set; }
    public string? Region { get; set; }
    public string? TenantHint { get; set; }
    public string? ProjectHint { get; set; }
    public LegacyBrowserPayload? LegacyBrowser { get; set; }

    // Untrusted client claims — ignored for authority
    public string? ClientIp { get; set; }
    public double? ClientRiskScore { get; set; }
    public double? ClientConfidence { get; set; }
    public string? ClientVisitorId { get; set; }
}

public sealed class LegacyBrowserPayload
{
    public string? VisitorId { get; set; }
    public string? SourceManifestRevision { get; set; }
    public string? HashingRevision { get; set; }
    public double? ConfidenceScore { get; set; }
    public string? ConfidenceComment { get; set; }
    public List<string>? ComponentKeys { get; set; }
    public string? SdkPackageVersion { get; set; }
}

public sealed class ObservationIngestAccepted
{
    public required string EventId { get; init; }
    public required string Status { get; init; } // accepted | duplicate
    public required string CorrelationId { get; init; }
    public required string ProcessingVersion { get; init; }
    public required string ServerTime { get; init; }
    public bool Duplicate { get; init; }
}

public sealed class ProblemDetailsBody
{
    public required string Type { get; init; }
    public required string Title { get; init; }
    public required int Status { get; init; }
    public required string Code { get; init; }
    public string? Detail { get; init; }
    public string? Instance { get; init; }
}
