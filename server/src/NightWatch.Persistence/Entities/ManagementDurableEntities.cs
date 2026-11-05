namespace NightWatch.Persistence.Entities;

/// <summary>
/// Denormalized management API key mirror (string tenant/env ids; no Environment FK).
/// In-memory ApiCredentialService remains the authz hot path; EF survives process restart.
/// </summary>
public sealed class ManagementApiKeyRow
{
    public Guid Id { get; set; }
    public string KeyId { get; set; } = "";
    public string PublicId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string EnvironmentId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Prefix { get; set; } = "";
    public string SecretHash { get; set; } = "";
    public string ScopesJson { get; set; } = "[]";
    public string DomainsJson { get; set; } = "[]";
    public int QuotaPerMinute { get; set; }
    public bool TrustedIngestion { get; set; }
    public bool Revoked { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RotatedAt { get; set; }
    public long UsageCount { get; set; }
}

public sealed class ManagementWebhookSubscriptionRow
{
    public Guid Id { get; set; }
    public string SubscriptionId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string EnvironmentId { get; set; } = "";
    public string TargetUrl { get; set; } = "";
    public string SigningSecret { get; set; } = "";
    public string? PreviousSigningSecret { get; set; }
    public string EventFiltersJson { get; set; } = "[]";
    public bool Enabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ManagementProjectRow
{
    public Guid Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string Name { get; set; } = "";
    public long Revision { get; set; } = 1;
    public int RetentionDays { get; set; } = 90;
    public string DomainPoliciesJson { get; set; } = "[]";
    public string WebhookIdsJson { get; set; } = "[]";
    public bool Deleted { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Denormalized legacy-hash → visitor alias for identify stability across restarts.</summary>
public sealed class VisitorAliasIndexRow
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "";
    public string Namespace { get; set; } = "";
    public string AliasKind { get; set; } = "legacy_browser_hash";
    public string AliasValue { get; set; } = "";
    public string VisitorId { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Denormalized device feature vectors for identify stability across process restarts.</summary>
public sealed class VisitorDeviceVectorRow
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "";
    public string Namespace { get; set; } = "";
    public string VisitorId { get; set; } = "";
    public string? ContinuityId { get; set; }
    public string? BlockKey { get; set; }
    public string FeaturesJson { get; set; } = "{}";
    public string VectorVersion { get; set; } = "night-watch-vector-v1";
    public DateTimeOffset ObservedAt { get; set; } = DateTimeOffset.UtcNow;
}
