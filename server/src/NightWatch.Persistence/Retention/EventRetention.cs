using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace NightWatch.Persistence.Retention;

/// <summary>
/// Retention helpers for identification_events. Physical Postgres partitioning
/// (RANGE on created_at per tenant) is planned in deploy docs; this API is storage-agnostic.
/// </summary>
public static class EventRetention
{
    public static DateTimeOffset ComputeRetainUntil(DateTimeOffset createdAt, int retentionDays)
    {
        if (retentionDays < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(retentionDays));
        }

        return createdAt.ToUniversalTime().AddDays(retentionDays);
    }

    public static async Task<List<IdentificationEvent>> ListExpiredEventsAsync(
        ProPlusDbContext db,
        DateTimeOffset utcNow,
        CancellationToken ct = default)
    {
        var cutoff = utcNow.UtcDateTime;
        // Materialize then filter RetainUntil for provider portability (SQLite DateTimeOffset?).
        var rows = await db.IdentificationEvents.AsNoTracking().ToListAsync(ct);
        return rows
            .Where(e => e.RetainUntil is not null && e.RetainUntil.Value.UtcDateTime < cutoff)
            .ToList();
    }

    public static async Task<List<IdentificationEvent>> VisitorHistoryAsync(
        ProPlusDbContext db,
        Guid tenantId,
        Guid visitorId,
        CancellationToken ct = default)
    {
        var rows = await db.IdentificationEvents
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.VisitorId == visitorId)
            .ToListAsync(ct);
        return rows.OrderByDescending(e => e.CreatedAt).ToList();
    }

    /// <summary>
    /// Counts events past RetainUntil for archival jobs. Does not hard-delete.
    /// </summary>
    public static async Task<int> MarkExpiredForArchivalAsync(
        ProPlusDbContext db,
        DateTimeOffset utcNow,
        CancellationToken ct = default)
    {
        var expired = await ListExpiredEventsAsync(db, utcNow, ct);
        return expired.Count;
    }
}
