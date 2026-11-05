namespace NightWatch.Persistence.Entities;

/// <summary>
/// Server-assigned opaque visitor. Never overwrite with legacy browser hash.
/// </summary>
public sealed class Visitor
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = ""; // v_...
    public Guid TenantId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public string IdentityAlgorithmVersion { get; set; } = "night-watch-identity-v0";
    public DateTimeOffset? DeletedAt { get; set; }
    public List<VisitorAlias> Aliases { get; set; } = [];
    public List<IdentificationEvent> Events { get; set; } = [];
}

/// <summary>
/// Links a legacy browser visitorId (32-hex) or other alias to a server visitor without conflating IDs.
/// </summary>
public sealed class VisitorAlias
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid VisitorId { get; set; }
    public Visitor Visitor { get; set; } = null!;
    public string AliasKind { get; set; } = "legacy_browser_hash"; // legacy_browser_hash | linked_account | other
    public string AliasValue { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LinkedAccount
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid VisitorId { get; set; }
    public Visitor Visitor { get; set; } = null!;
    public string SubjectKey { get; set; } = ""; // tenant-scoped pseudonym
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UnlinkedAt { get; set; }
}

public sealed class IdentityEdge
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid FromVisitorId { get; set; }
    public Guid ToVisitorId { get; set; }
    public string EdgeType { get; set; } = "probable_same"; // probable_same | merge | split
    public string EvidenceStatus { get; set; } = "unknown";
    public double? Confidence { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpiresAt { get; set; }
}

/// <summary>Immutable identification event (append-only).</summary>
public sealed class IdentificationEvent
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = ""; // ev_...
    public Guid TenantId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid EnvironmentId { get; set; }
    public Guid VisitorId { get; set; }
    public Visitor Visitor { get; set; } = null!;
    public string? LegacyBrowserVisitorId { get; set; } // 32-hex; separate column
    public string MatchType { get; set; } = "unknown";
    public string IdentityOutcome { get; set; } = "unsupported";
    public string ProcessingVersion { get; set; } = "night-watch-processing-v0";
    public string IdentityAlgorithmVersion { get; set; } = "night-watch-identity-v0";
    public string Region { get; set; } = "local";
    public string? IdempotencyKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RetainUntil { get; set; }
    public List<SignalObservation> Signals { get; set; } = [];
    public List<EvidenceRecord> Evidence { get; set; } = [];
    public List<CollectorFailure> CollectorFailures { get; set; } = [];
    public EventDecision? Decision { get; set; }
}

public sealed class SignalObservation
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EventId { get; set; }
    public IdentificationEvent Event { get; set; } = null!;
    public string SignalId { get; set; } = "";
    public string Status { get; set; } = "unknown"; // known|unknown|unsupported|unavailable|not_applicable|...
    public string? ValueJson { get; set; }
    public double? Confidence { get; set; }
    public string Provenance { get; set; } = "server";
    public string? Reason { get; set; }
    public string? ModelVersion { get; set; }
    public string? SourceQuality { get; set; } // high|medium|low|unknown
}

public sealed class EvidenceRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EventId { get; set; }
    public IdentificationEvent Event { get; set; } = null!;
    public string EvidenceKind { get; set; } = "feature";
    public string Status { get; set; } = "unknown";
    public string PayloadJson { get; set; } = "{}";
    public string Provenance { get; set; } = "browser_sdk";
    public DateTimeOffset ObservedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CollectorFailure
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EventId { get; set; }
    public IdentificationEvent Event { get; set; } = null!;
    public string SourceName { get; set; } = "";
    public string ErrorKind { get; set; } = "error";
    public string? SafeMessage { get; set; }
    public int? DurationMs { get; set; }
}

public sealed class EventDecision
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EventId { get; set; }
    public IdentificationEvent Event { get; set; } = null!;
    public string Status { get; set; } = "insufficient_evidence";
    public string Decision { get; set; } = "observe";
    public string PolicyVersion { get; set; } = "1";
    public double? Score { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
