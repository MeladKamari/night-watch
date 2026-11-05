namespace NightWatch.Modules.Identity;

public sealed class IdentifyRequest
{
    public string? SchemaVersion { get; set; }
    public string? ProductCode { get; set; }
    public string? Purpose { get; set; }
    public string? ConsentStatus { get; set; }
    public string? CollectedAt { get; set; }
    public string? IdempotencyKey { get; set; }
    public string? TenantId { get; set; }
    public string? ProjectId { get; set; }
    public string? Region { get; set; }
    public LegacyIdentifyBrowser? LegacyBrowser { get; set; }

    // Untrusted — never authoritative for matching
    public string? ClientVisitorId { get; set; }
    public double? ClientConfidence { get; set; }

    /// <summary>Optional device context for fuzzy insights (never sole authority for visitorId).</summary>
    public ClientDeviceContext? ClientDevice { get; set; }

    /// <summary>Optional first-party continuity token (cookie value or SPA-stored token).</summary>
    public string? ContinuityToken { get; set; }

    /// <summary>Legal basis for issuing continuity cookie; defaults to legitimate_interest.</summary>
    public string? ContinuityLegalBasis { get; set; }
}

public sealed class ClientDeviceContext
{
    public string? Platform { get; set; }
    public string? OsFamily { get; set; }
    public string? BrowserFamily { get; set; }
    public string? Locale { get; set; }
    public int? ScreenWidth { get; set; }
    public int? ScreenHeight { get; set; }
    public string? WebGlRenderer { get; set; }
}

public sealed class LegacyIdentifyBrowser
{
    public string? VisitorId { get; set; }
    public string? SourceManifestRevision { get; set; }
    public List<string>? ComponentKeys { get; set; }
}

public sealed record MatchCandidateInsight(
    string VisitorId,
    double Score,
    string Decision,
    IReadOnlyList<string> AgreeingFeatures);

public sealed record MatchInsights(
    string Status, // none | scored
    string? BestCandidateVisitorId,
    double? BestScore,
    string? BestDecision,
    bool SoftLinked,
    string Note,
    IReadOnlyList<MatchCandidateInsight> TopCandidates);

public sealed record ContinuityInfo(
    string Status, // issued | renewed | missing | invalid | revoked | skipped
    string? ContinuityId,
    string? Token,
    string? CookieName,
    string Claim,
    string? Code);

public sealed record IdentifyResponse
{
    public required string VisitorId { get; init; }
    public required string EventId { get; init; }
    public required string MatchType { get; init; } // matched | created | ambiguous
    public required string FirstSeenAt { get; init; }
    public required string LastSeenAt { get; init; }
    /// <summary>Set for heuristic or calibrated confidence; null when unavailable.</summary>
    public double? Confidence { get; init; }
    /// <summary>calibrated | heuristic | unavailable | unknown</summary>
    public required string ConfidenceStatus { get; init; }
    public string? ConfidenceNote { get; init; }
    public required string EnrichmentStatus { get; init; } // pending | completed | unavailable
    public required string Receipt { get; init; }
    public required string ReceiptExpiresAt { get; init; }
    public required string IdentityAlgorithmVersion { get; init; }
    public required string ProcessingVersion { get; init; }
    public required string Namespace { get; init; }
    public bool Duplicate { get; init; }
    public required string CorrelationId { get; init; }
    public MatchInsights? MatchInsights { get; init; }
    public ContinuityInfo? Continuity { get; init; }
}

public sealed class IdentifyProblem
{
    public required string Type { get; init; }
    public required string Title { get; init; }
    public required int Status { get; init; }
    public required string Code { get; init; }
    public string? Detail { get; set; }
    public string? Instance { get; set; }
}
