namespace NightWatch.Modules.Webhooks;

public static class WebhookEventTypes
{
    public const string EventIdentification = "event.identification";
    public const string EventRisk = "event.risk";
    public const string VisitorMerge = "visitor.merge";
    public const string VisitorDeleted = "visitor.deleted";
    public const string FeedbackUpdated = "feedback.updated";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        EventIdentification, EventRisk, VisitorMerge, VisitorDeleted, FeedbackUpdated
    };
}

public sealed class WebhookSubscription
{
    public required string SubscriptionId { get; init; }
    public required string TenantId { get; init; }
    public required string EnvironmentId { get; init; }
    public required string TargetUrl { get; set; }
    public required string SigningSecret { get; set; }
    public string? PreviousSigningSecret { get; set; }
    public required HashSet<string> EventFilters { get; init; }
    public bool Enabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class WebhookDeliveryRecord
{
    public required string DeliveryId { get; init; }
    public required string SubscriptionId { get; init; }
    public required string TenantId { get; init; }
    public required string EventType { get; init; }
    public required string PayloadJson { get; init; }
    public required string Status { get; set; } // pending | delivered | dead | circuit_open
    public int Attempts { get; set; }
    public DateTimeOffset? NextAttemptAt { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeliveredAt { get; set; }
    public string? LastError { get; set; }
    public string? SignatureHeader { get; set; }
    public long TimestampUnix { get; set; }
}

public sealed class WebhookEnvelope
{
    public required string SchemaVersion { get; init; }
    public required string EventType { get; init; }
    public required string DeliveryId { get; init; }
    public required string TenantId { get; init; }
    public required string EnvironmentId { get; init; }
    public required string OccurredAt { get; init; }
    public required object Data { get; init; }
    /// <summary>Consumers must treat deliveries as at-least-once; dedupe on deliveryId.</summary>
    public string DeliveryGuarantee { get; init; } = "at_least_once_not_exactly_once";
}
