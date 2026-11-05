namespace NightWatch.Persistence.Entities;

public abstract class AuditedEntity
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }
    public bool IsDeleted => DeletedAt is not null;
}

public sealed class Tenant : AuditedEntity
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = "";
    public string Name { get; set; } = "";
    public int DefaultRetentionDays { get; set; } = 90;
    public List<Project> Projects { get; set; } = [];
}

public sealed class Project : AuditedEntity
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = "";
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public string Name { get; set; } = "";
    public List<EnvironmentEntity> Environments { get; set; } = [];
}

public sealed class EnvironmentEntity : AuditedEntity
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = "";
    public Guid TenantId { get; set; }
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Name { get; set; } = "";
    public List<OriginAllowlist> Origins { get; set; } = [];
    public List<ScopedApiKey> ApiKeys { get; set; } = [];
}

public sealed class OriginAllowlist : AuditedEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid EnvironmentId { get; set; }
    public EnvironmentEntity Environment { get; set; } = null!;
    public string OriginPattern { get; set; } = "";
}

public sealed class ScopedApiKey : AuditedEntity
{
    public Guid Id { get; set; }
    public string PublicId { get; set; } = "";
    public Guid TenantId { get; set; }
    public Guid EnvironmentId { get; set; }
    public EnvironmentEntity Environment { get; set; } = null!;
    public string KeyKind { get; set; } = "public_collect";
    public string KeyId { get; set; } = "";
    public byte[] PublicKeyMaterial { get; set; } = [];
    public byte[]? SecretKeyMaterialEncrypted { get; set; }
}

public sealed class AuditLogEntry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Actor { get; set; } = "";
    public string Action { get; set; } = "";
    public string ResourceType { get; set; } = "";
    public string ResourceId { get; set; } = "";
}
