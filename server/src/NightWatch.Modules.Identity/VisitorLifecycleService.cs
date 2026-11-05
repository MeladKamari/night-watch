using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Identity;

public sealed class ErasureTombstone
{
    public required string TombstoneId { get; init; }
    public required string TenantId { get; init; }
    /// <summary>HMAC of visitor public id — not reversible to reconstruct identity.</summary>
    public required string VisitorIdDigest { get; init; }
    public required DateTimeOffset ErasedAt { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
    public required string PolicyVersion { get; init; }
}

public sealed class ErasureQueueItem
{
    public required string JobId { get; init; }
    public required string TenantId { get; init; }
    public required string StorageTarget { get; init; } // catalog | alias_index | cache | graph
    public required string Status { get; init; } // queued | done | unavailable
    public required DateTimeOffset EnqueuedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
}

public sealed class PrivacyExportDocument
{
    public required string ExportId { get; init; }
    public required string TenantId { get; init; }
    public required string VisitorId { get; init; }
    public required string GeneratedAt { get; init; }
    public required string RetentionPolicyDays { get; init; }
    public required string BackupsPolicy { get; init; }
    public required object Events { get; init; }
    public required string Note { get; init; }
}

public interface IVisitorErasureRegistry
{
    bool IsErased(string tenantId, string visitorId);
    void MarkErased(string tenantId, string visitorId);
}

public sealed class InMemoryVisitorErasureRegistry : IVisitorErasureRegistry
{
    private readonly ConcurrentDictionary<string, byte> _erased = new(StringComparer.Ordinal);

    public bool IsErased(string tenantId, string visitorId) =>
        _erased.ContainsKey($"{tenantId}:{visitorId}");

    public void MarkErased(string tenantId, string visitorId) =>
        _erased[$"{tenantId}:{visitorId}"] = 1;
}

public interface IVisitorLifecycleService
{
    (int StatusCode, object Body) DeleteVisitor(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? reason);
    (int StatusCode, object Body) ExportVisitor(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? actor);
    IReadOnlyList<ErasureTombstone> ListTombstones(string tenantId);
    IReadOnlyList<ErasureQueueItem> ListErasureJobs(string tenantId);
}

public sealed class VisitorLifecycleOptions
{
    public int RetentionDays { get; set; } = 90;
    public string BackupsPolicy { get; set; } = "encrypted_offline_retention_30d_then_purge_queue";
    public string ErasurePolicyVersion { get; set; } = "night-watch-erasure-v1";
    public string TombstoneHmacKey { get; set; } = "night-watch-dev-tombstone-key";
}

public sealed class VisitorLifecycleService(
    IIdentificationEventCatalog catalog,
    IVisitorErasureRegistry erasureRegistry,
    IIdentifyService identify,
    ILogger<VisitorLifecycleService> logger,
    VisitorLifecycleOptions? options = null) : IVisitorLifecycleService
{
    private readonly VisitorLifecycleOptions _options = options ?? new VisitorLifecycleOptions();
    private readonly ConcurrentBag<ErasureTombstone> _tombstones = [];
    private readonly ConcurrentBag<ErasureQueueItem> _jobs = [];

    public (int StatusCode, object Body) DeleteVisitor(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? reason)
    {
        if (!AuthAdmin(apiKeyKind, out var problem) || !RequireTenant(tenantId, out problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(actor))
        {
            return Problem(400, "actor_required", "X-Actor-Id required");
        }

        if (string.IsNullOrWhiteSpace(visitorId) || !visitorId.StartsWith("v_", StringComparison.Ordinal))
        {
            return Problem(400, "visitor_id_invalid", "visitorId format invalid");
        }

        if (erasureRegistry.IsErased(tenantId!, visitorId))
        {
            return Problem(410, "visitor_already_erased", "Visitor already erased");
        }

        var events = catalog.ListByVisitor(visitorId, tenantId!);
        if (events.Count == 0)
        {
            return Problem(404, "visitor_not_found", "Visitor not found");
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var ev in events)
        {
            catalog.Upsert(ev with
            {
                DeletedAt = now,
                EventStatus = "deleted",
                Sequence = ev.Sequence
            });
        }

        erasureRegistry.MarkErased(tenantId!, visitorId);
        if (identify is IdentifyService concrete)
        {
            concrete.PurgeVisitorAliases(tenantId!, visitorId);
        }

        var digest = DigestVisitor(tenantId!, visitorId);
        var tombstone = new ErasureTombstone
        {
            TombstoneId = "ts_" + Guid.NewGuid().ToString("N")[..16],
            TenantId = tenantId!,
            VisitorIdDigest = digest,
            ErasedAt = now,
            Actor = actor,
            Reason = string.IsNullOrWhiteSpace(reason) ? "erasure_request" : reason!,
            PolicyVersion = _options.ErasurePolicyVersion
        };
        _tombstones.Add(tombstone);

        foreach (var target in new[] { "catalog", "alias_index", "cache", "graph" })
        {
            _jobs.Add(new ErasureQueueItem
            {
                JobId = "ej_" + Guid.NewGuid().ToString("N")[..12],
                TenantId = tenantId!,
                StorageTarget = target,
                Status = target is "catalog" or "alias_index" ? "done" : "queued",
                EnqueuedAt = now,
                CompletedAt = target is "catalog" or "alias_index" ? now : null
            });
        }

        logger.LogInformation(
            "visitor_erasure tombstone={Tombstone} tenant={Tenant} actor={Actor} events={Count}",
            tombstone.TombstoneId,
            tenantId,
            actor,
            events.Count);

        return (200, new
        {
            status = "erased",
            tombstoneId = tombstone.TombstoneId,
            visitorIdDigest = digest,
            eventsSoftDeleted = events.Count,
            jobsQueued = _jobs.Count(j => j.TenantId == tenantId),
            policyVersion = _options.ErasurePolicyVersion
        });
    }

    public (int StatusCode, object Body) ExportVisitor(
        string visitorId,
        string? tenantId,
        string? apiKeyKind,
        string? actor)
    {
        if (!AuthAdmin(apiKeyKind, out var problem) || !RequireTenant(tenantId, out problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(actor))
        {
            return Problem(400, "actor_required", "X-Actor-Id required");
        }

        if (erasureRegistry.IsErased(tenantId!, visitorId))
        {
            return Problem(410, "visitor_erased", "Visitor erased; export unavailable");
        }

        var events = catalog.ListByVisitor(visitorId, tenantId!)
            .Where(e => e.DeletedAt is null)
            .Select(e => new
            {
                e.EventId,
                e.MatchType,
                e.SignalStatus,
                e.CreatedAt,
                profile = "redacted"
            })
            .ToList();

        if (events.Count == 0)
        {
            return Problem(404, "visitor_not_found", "Visitor not found");
        }

        var doc = new PrivacyExportDocument
        {
            ExportId = "exp_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId!,
            VisitorId = visitorId,
            GeneratedAt = DateTimeOffset.UtcNow.ToString("O"),
            RetentionPolicyDays = _options.RetentionDays.ToString(),
            BackupsPolicy = _options.BackupsPolicy,
            Events = events,
            Note = "Administrator privacy export; raw fingerprint components excluded"
        };

        logger.LogInformation(
            "privacy_export export={ExportId} tenant={Tenant} actor={Actor} events={Count}",
            doc.ExportId,
            tenantId,
            actor,
            events.Count);

        return (200, doc);
    }

    public IReadOnlyList<ErasureTombstone> ListTombstones(string tenantId) =>
        _tombstones.Where(t => t.TenantId == tenantId).ToList();

    public IReadOnlyList<ErasureQueueItem> ListErasureJobs(string tenantId) =>
        _jobs.Where(j => j.TenantId == tenantId).ToList();

    private string DigestVisitor(string tenantId, string visitorId)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.TombstoneHmacKey));
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{tenantId}|{visitorId}"));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool AuthAdmin(string? apiKeyKind, out (int, object) problem)
    {
        if (string.IsNullOrWhiteSpace(apiKeyKind))
        {
            problem = Problem(401, "unauthorized", "Server API key required");
            return false;
        }

        if (!string.Equals(apiKeyKind, "server", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(apiKeyKind, "secret", StringComparison.OrdinalIgnoreCase))
        {
            problem = Problem(403, "forbidden", "Administrator server key required");
            return false;
        }

        problem = default;
        return true;
    }

    private static bool RequireTenant(string? tenantId, out (int, object) problem)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            problem = Problem(400, "tenant_required", "X-Tenant-Id required");
            return false;
        }

        problem = default;
        return true;
    }

    private static (int, object) Problem(int status, string code, string detail) =>
        (status, new IdentifyProblem
        {
            Type = $"https://night-watch.local/problems/{code}",
            Title = code,
            Status = status,
            Code = code,
            Detail = detail
        });
}
