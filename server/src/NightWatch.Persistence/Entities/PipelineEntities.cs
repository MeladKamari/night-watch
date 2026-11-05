namespace NightWatch.Persistence.Entities;

/// <summary>
/// Business event lifecycle for sync baseline + async enrichment.
/// States: created → enriched → evaluated.
/// </summary>
public sealed class PipelineBusinessEvent
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = "";
    public Guid TenantId { get; set; }
    public string State { get; set; } = PipelineStates.Created;
    /// <summary>Monotonic revision; stale writers must not overwrite.</summary>
    public long Revision { get; set; }
    public string EventVersion { get; set; } = "night-watch-pipeline-v1";
    public string BaselineJson { get; set; } = "{}";
    public string? EnrichmentJson { get; set; }
    public string? EvaluationJson { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EnrichedAt { get; set; }
    public DateTimeOffset? EvaluatedAt { get; set; }
}

public static class PipelineStates
{
    public const string Created = "created";
    public const string Enriched = "enriched";
    public const string Evaluated = "evaluated";
}

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BusinessEventId { get; set; }
    public string MessageType { get; set; } = "enrich";
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = OutboxStatuses.Pending;
    public int AttemptCount { get; set; }
    public DateTimeOffset? NextAttemptAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ProcessedAt { get; set; }
    public string? LastError { get; set; }
    /// <summary>Revision the worker expects when applying this message.</summary>
    public long ExpectedRevision { get; set; }
    public string IdempotencyKey { get; set; } = "";
}

public static class OutboxStatuses
{
    public const string Pending = "pending";
    public const string Processing = "processing";
    public const string Done = "done";
    public const string Dead = "dead";
}

/// <summary>Consumer-side idempotency (inbox) so crash/retry yields one business effect.</summary>
public sealed class InboxReceipt
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string MessageKey { get; set; } = "";
    public Guid OutboxMessageId { get; set; }
    public DateTimeOffset ProcessedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class DeadLetterMessage
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OutboxMessageId { get; set; }
    public Guid BusinessEventId { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public string Reason { get; set; } = "";
    public int Attempts { get; set; }
    public DateTimeOffset DeadAt { get; set; } = DateTimeOffset.UtcNow;
}
