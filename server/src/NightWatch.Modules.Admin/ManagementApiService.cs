using System.Collections.Concurrent;

namespace NightWatch.Modules.Admin;

public enum AdminRole
{
    Analyst,
    Administrator,
    Security,
    DataProtectionOfficer
}

public sealed class ManagedProject
{
    public required string ProjectId { get; init; }
    public required string TenantId { get; init; }
    public required string Name { get; set; }
    public long Revision { get; set; } = 1;
    public int RetentionDays { get; set; } = 90;
    public List<string> DomainPolicies { get; set; } = [];
    public List<string> WebhookIds { get; set; } = [];
    public bool Deleted { get; set; }
}

public sealed class SignedAuditEvent
{
    public required string AuditId { get; init; }
    public required string TenantId { get; init; }
    public required string Actor { get; init; }
    public required string Role { get; init; }
    public required string Action { get; init; }
    public required string ResourceType { get; init; }
    public required string ResourceId { get; init; }
    public required long RevisionBefore { get; init; }
    public required long RevisionAfter { get; init; }
    public required string At { get; init; }
    public required string ApiVersion { get; init; }
    public required string Signature { get; init; }
}

public interface IManagementApiService
{
    (int Status, object Body) CreateProject(string tenantId, string name, string actor, AdminRole role);
    (int Status, object Body) PatchProject(string tenantId, string projectId, string? name, int? retentionDays, long ifMatchRevision, string actor, AdminRole role);
    (int Status, object Body) ListProjects(string tenantId, string actor, AdminRole role, string? cursor, int limit);
    IReadOnlyList<SignedAuditEvent> ListAudit(string tenantId);
}

public sealed class ManagementApiService(
    IAdminAuditSink? auditSink = null,
    IManagementProjectDurableSink? projectSink = null) : IManagementApiService
{
    public const string ApiVersion = "management-v1";
    public const string DeprecatedAlias = "management-v0-compat";

    private readonly IAdminAuditSink _auditSink = auditSink ?? new NullAdminAuditSink();
    private readonly IManagementProjectDurableSink _projectSink = projectSink ?? new NullManagementProjectDurableSink();
    private readonly ConcurrentDictionary<string, ManagedProject> _projects = new(StringComparer.Ordinal);
    private readonly ConcurrentBag<SignedAuditEvent> _audit = [];
    private long _seq;

    public void Hydrate(IEnumerable<ManagedProject> projects)
    {
        foreach (var p in projects)
        {
            _projects[Key(p.TenantId, p.ProjectId)] = p;
        }
    }

    public (int Status, object Body) CreateProject(string tenantId, string name, string actor, AdminRole role)
    {
        if (!CanMutate(role))
        {
            return Problem(403, "forbidden_role", "Role cannot mutate projects");
        }

        var id = "prj_" + Guid.NewGuid().ToString("N")[..10];
        var p = new ManagedProject { ProjectId = id, TenantId = tenantId, Name = name };
        _projects[Key(tenantId, id)] = p;
        _projectSink.Upsert(p);
        SignAudit(tenantId, actor, role, "project.create", "project", id, 0, 1);
        return (201, p);
    }

    public (int Status, object Body) PatchProject(
        string tenantId,
        string projectId,
        string? name,
        int? retentionDays,
        long ifMatchRevision,
        string actor,
        AdminRole role)
    {
        if (!CanMutate(role))
        {
            return Problem(403, "forbidden_role", "Role cannot mutate projects");
        }

        if (!_projects.TryGetValue(Key(tenantId, projectId), out var p) || p.Deleted)
        {
            // Cross-tenant or missing → 404
            return Problem(404, "project_not_found", "Project not found");
        }

        if (p.Revision != ifMatchRevision)
        {
            return Problem(409, "revision_conflict", $"Expected {ifMatchRevision}, current {p.Revision}");
        }

        var before = p.Revision;
        if (name is not null) p.Name = name;
        if (retentionDays is not null) p.RetentionDays = retentionDays.Value;
        p.Revision++;
        _projectSink.Upsert(p);
        SignAudit(tenantId, actor, role, "project.patch", "project", projectId, before, p.Revision);
        return (200, p);
    }

    public (int Status, object Body) ListProjects(string tenantId, string actor, AdminRole role, string? cursor, int limit)
    {
        if (!CanRead(role))
        {
            return Problem(403, "forbidden_role", "Role cannot list projects");
        }

        _ = actor;
        limit = Math.Clamp(limit, 1, 100);
        var after = 0L;
        if (!string.IsNullOrWhiteSpace(cursor) && !long.TryParse(cursor, out after))
        {
            return Problem(400, "cursor_invalid", "cursor invalid");
        }

        var items = _projects.Values
            .Where(p => p.TenantId == tenantId && !p.Deleted)
            .OrderBy(p => p.ProjectId)
            .SkipWhile(p => string.CompareOrdinal(p.ProjectId, $"prj_{after:D10}") <= 0 && after != 0)
            .Take(limit + 1)
            .ToList();

        // simpler cursor by index sequence
        var all = _projects.Values.Where(p => p.TenantId == tenantId && !p.Deleted).OrderBy(p => p.ProjectId).ToList();
        var start = 0;
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            var idx = all.FindIndex(p => p.ProjectId == cursor);
            start = idx < 0 ? 0 : idx + 1;
        }

        var page = all.Skip(start).Take(limit).ToList();
        var next = start + limit < all.Count ? page.LastOrDefault()?.ProjectId : null;
        return (200, new { apiVersion = ApiVersion, items = page, nextCursor = next });
    }

    public IReadOnlyList<SignedAuditEvent> ListAudit(string tenantId) =>
        _audit.Where(a => a.TenantId == tenantId).ToList();

    private void SignAudit(
        string tenantId,
        string actor,
        AdminRole role,
        string action,
        string resourceType,
        string resourceId,
        long before,
        long after)
    {
        var id = "aud_" + Interlocked.Increment(ref _seq).ToString("D8");
        var material = $"{tenantId}|{actor}|{action}|{resourceId}|{before}|{after}|{ApiVersion}";
        var sig = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(material))).ToLowerInvariant();
        var evt = new SignedAuditEvent
        {
            AuditId = id,
            TenantId = tenantId,
            Actor = actor,
            Role = role.ToString(),
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            RevisionBefore = before,
            RevisionAfter = after,
            At = DateTimeOffset.UtcNow.ToString("O"),
            ApiVersion = ApiVersion,
            Signature = "sha256:" + sig
        };
        _audit.Add(evt);
        _auditSink.Write(evt);
    }

    private static bool CanMutate(AdminRole role) =>
        role is AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer;

    private static bool CanRead(AdminRole role) =>
        role is AdminRole.Analyst or AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer;

    private static string Key(string tenantId, string projectId) => $"{tenantId}:{projectId}";

    private static (int, object) Problem(int status, string code, string detail) =>
        (status, new Dictionary<string, object?>
        {
            ["type"] = $"https://night-watch.local/problems/{code}",
            ["title"] = code,
            ["status"] = status,
            ["code"] = code,
            ["detail"] = detail,
            ["apiVersion"] = ApiVersion
        });
}
