using NightWatch.Modules.Admin;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Dual-writes management audit into EF when Postgres DbContext is registered.
/// </summary>
public sealed class EfAdminAuditSink(IServiceScopeFactory scopes, ILogger<EfAdminAuditSink> logger) : IAdminAuditSink
{
    public void Write(SignedAuditEvent entry)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetService<ProPlusDbContext>();
            if (db is null) return;

            var tenantGuid = Guid.ParseExact(
                Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("tenant|" + entry.TenantId)))[..32],
                "N");

            db.AuditLog.Add(new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantGuid,
                CreatedAt = DateTimeOffset.TryParse(entry.At, out var at) ? at : DateTimeOffset.UtcNow,
                Actor = entry.Actor,
                Action = entry.Action,
                ResourceType = entry.ResourceType,
                ResourceId = entry.ResourceId
            });
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_admin_audit_sink_failed auditId={AuditId}", entry.AuditId);
        }
    }
}
