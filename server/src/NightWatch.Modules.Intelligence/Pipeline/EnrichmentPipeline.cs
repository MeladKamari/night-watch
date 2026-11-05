using System.Security.Cryptography;
using System.Text.Json;
using NightWatch.BuildingBlocks;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Intelligence.Pipeline;

public sealed class EnrichmentPipelineOptions
{
    public int MaxAttempts { get; set; } = 5;
    public TimeSpan InitialBackoff { get; set; } = TimeSpan.FromMilliseconds(50);
    public double BackoffFactor { get; set; } = 2.0;
}

public sealed record AcceptObservationInput(
    Guid TenantId,
    IReadOnlyList<string> ComponentKeys,
    string? Purpose,
    IReadOnlyDictionary<string, JsonElement>? PartialSignals);

public sealed record AcceptObservationResult(
    string EventPublicId,
    string State,
    long Revision,
    string BaselineStatus);

public interface IEnrichmentPipeline
{
    Task<AcceptObservationResult> AcceptAsync(AcceptObservationInput input, CancellationToken ct = default);
}

public interface IEnrichmentWorker
{
    Task<int> ProcessPendingAsync(CancellationToken ct = default);
    Task SimulateCrashAfterClaimAsync(Guid outboxId, CancellationToken ct = default);
}

/// <summary>
/// Optional costly lookup. Production may inject licensed providers; default marks Unavailable.
/// </summary>
public interface IAsyncEnrichmentProvider
{
    Task<EvidenceCell<object?>> LookupAsync(Guid tenantId, string eventPublicId, CancellationToken ct = default);
}

public sealed class UnavailableAsyncEnrichmentProvider : IAsyncEnrichmentProvider
{
    public Task<EvidenceCell<object?>> LookupAsync(Guid tenantId, string eventPublicId, CancellationToken ct = default) =>
        Task.FromResult(Evidence.Unavailable<object?>("async_enrichment", "provider_not_configured"));
}

public sealed class EnrichmentPipeline(
    ProPlusDbContext db,
    EnrichmentPipelineOptions? options = null) : IEnrichmentPipeline
{
    private readonly EnrichmentPipelineOptions _options = options ?? new EnrichmentPipelineOptions();

    public async Task<AcceptObservationResult> AcceptAsync(AcceptObservationInput input, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var publicId = "ev_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
        var baseline = EvaluateBaselineSync(input);

        var business = new PipelineBusinessEvent
        {
            Id = Guid.NewGuid(),
            PublicId = publicId,
            TenantId = input.TenantId,
            State = PipelineStates.Created,
            Revision = 1,
            EventVersion = "night-watch-pipeline-v1",
            BaselineJson = JsonSerializer.Serialize(baseline),
            CreatedAt = now
        };

        var outboxId = Guid.NewGuid();
        var outbox = new OutboxMessage
        {
            Id = outboxId,
            TenantId = input.TenantId,
            BusinessEventId = business.Id,
            MessageType = "enrich",
            PayloadJson = JsonSerializer.Serialize(new
            {
                eventPublicId = publicId,
                purpose = input.Purpose
            }),
            Status = OutboxStatuses.Pending,
            AttemptCount = 0,
            NextAttemptAt = now,
            CreatedAt = now,
            ExpectedRevision = 1,
            IdempotencyKey = $"enrich:{publicId}:r1"
        };

        db.PipelineEvents.Add(business);
        db.OutboxMessages.Add(outbox);
        await db.SaveChangesAsync(ct);

        return new AcceptObservationResult(
            publicId,
            business.State,
            business.Revision,
            baseline.Status);
    }

    /// <summary>Deterministic sync baseline — never invents positive risk from partial data.</summary>
    public static BaselineSnapshot EvaluateBaselineSync(AcceptObservationInput input)
    {
        var keys = input.ComponentKeys ?? Array.Empty<string>();
        if (keys.Any(k => string.Equals(k, "applePay", StringComparison.Ordinal)))
        {
            return new BaselineSnapshot(
                Status: "rejected",
                Reason: "apple_pay_forbidden",
                ComponentCount: keys.Count,
                PartialSignalCount: input.PartialSignals?.Count ?? 0,
                DecisionHint: "observe");
        }

        var partial = input.PartialSignals?.Count ?? 0;
        // Partial datasets → insufficient_evidence, not a false-negative "safe" claim.
        var status = partial == 0 && keys.Count == 0
            ? "insufficient_evidence"
            : partial > 0 && keys.Count < 5
                ? "insufficient_evidence"
                : "baseline_ready";

        return new BaselineSnapshot(
            Status: status,
            Reason: status == "insufficient_evidence" ? "partial_or_empty_dataset" : null,
            ComponentCount: keys.Count,
            PartialSignalCount: partial,
            DecisionHint: "observe");
    }
}

public sealed record BaselineSnapshot(
    string Status,
    string? Reason,
    int ComponentCount,
    int PartialSignalCount,
    string DecisionHint);

public sealed class EnrichmentWorker(
    ProPlusDbContext db,
    IAsyncEnrichmentProvider enrichmentProvider,
    ILogger<EnrichmentWorker> logger,
    EnrichmentPipelineOptions? options = null) : IEnrichmentWorker
{
    private readonly EnrichmentPipelineOptions _options = options ?? new EnrichmentPipelineOptions();

    public async Task<int> ProcessPendingAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        // SQLite cannot ORDER BY / compare DateTimeOffset in SQL — client-side schedule filter.
        var candidates = await db.OutboxMessages
            .Where(m => m.Status == OutboxStatuses.Pending)
            .Take(128)
            .ToListAsync(ct);
        var pending = candidates
            .Where(m => m.NextAttemptAt is null || m.NextAttemptAt <= now)
            .OrderBy(m => m.CreatedAt)
            .Take(32)
            .ToList();

        var processed = 0;
        foreach (var msg in pending)
        {
            await ProcessOneAsync(msg, crashAfterClaim: false, ct);
            processed++;
        }

        return processed;
    }

    /// <summary>Test hook: claim message then stop before inbox/business write (simulates crash).</summary>
    public Task SimulateCrashAfterClaimAsync(Guid outboxId, CancellationToken ct = default) =>
        ProcessOneByIdAsync(outboxId, crashAfterClaim: true, ct);

    private async Task ProcessOneByIdAsync(Guid outboxId, bool crashAfterClaim, CancellationToken ct)
    {
        var msg = await db.OutboxMessages.FirstAsync(m => m.Id == outboxId, ct);
        await ProcessOneAsync(msg, crashAfterClaim, ct);
    }

    private async Task ProcessOneAsync(OutboxMessage msg, bool crashAfterClaim, CancellationToken ct)
    {
        msg.Status = OutboxStatuses.Processing;
        msg.AttemptCount++;
        await db.SaveChangesAsync(ct);

        if (crashAfterClaim)
        {
            // Leave as processing without inbox — retry path will recover.
            msg.Status = OutboxStatuses.Pending;
            msg.NextAttemptAt = DateTimeOffset.UtcNow;
            msg.LastError = "simulated_crash_after_claim";
            await db.SaveChangesAsync(ct);
            return;
        }

        // Inbox idempotency: same message key → one business effect.
        var already = await db.InboxReceipts
            .AnyAsync(r => r.TenantId == msg.TenantId && r.MessageKey == msg.IdempotencyKey, ct);
        if (already)
        {
            msg.Status = OutboxStatuses.Done;
            msg.ProcessedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return;
        }

        try
        {
            if (msg.MessageType == "enrich")
            {
                await ApplyEnrichmentAsync(msg, ct);
            }
            else if (msg.MessageType == "evaluate")
            {
                await ApplyEvaluationAsync(msg, ct);
            }
            else
            {
                throw new InvalidOperationException("unknown_message_type");
            }

            db.InboxReceipts.Add(new InboxReceipt
            {
                Id = Guid.NewGuid(),
                TenantId = msg.TenantId,
                MessageKey = msg.IdempotencyKey,
                OutboxMessageId = msg.Id,
                ProcessedAt = DateTimeOffset.UtcNow
            });
            msg.Status = OutboxStatuses.Done;
            msg.ProcessedAt = DateTimeOffset.UtcNow;
            msg.LastError = null;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "outbox_process_failed id={OutboxId} attempt={Attempt}", msg.Id, msg.AttemptCount);
            msg.LastError = Sanitize(ex.Message);
            if (msg.AttemptCount >= _options.MaxAttempts)
            {
                msg.Status = OutboxStatuses.Dead;
                db.DeadLetterMessages.Add(new DeadLetterMessage
                {
                    Id = Guid.NewGuid(),
                    TenantId = msg.TenantId,
                    OutboxMessageId = msg.Id,
                    BusinessEventId = msg.BusinessEventId,
                    PayloadJson = msg.PayloadJson,
                    Reason = msg.LastError ?? "max_attempts",
                    Attempts = msg.AttemptCount,
                    DeadAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                msg.Status = OutboxStatuses.Pending;
                var delay = TimeSpan.FromMilliseconds(
                    _options.InitialBackoff.TotalMilliseconds * Math.Pow(_options.BackoffFactor, msg.AttemptCount - 1));
                msg.NextAttemptAt = DateTimeOffset.UtcNow.Add(delay);
            }

            await db.SaveChangesAsync(ct);
        }
    }

    private async Task ApplyEnrichmentAsync(OutboxMessage msg, CancellationToken ct)
    {
        var business = await db.PipelineEvents.FirstAsync(e => e.Id == msg.BusinessEventId, ct);

        // Out-of-order / stale: do not overwrite a newer revision.
        if (msg.ExpectedRevision < business.Revision)
        {
            logger.LogInformation(
                "stale_enrichment_skipped event={EventId} expected={Expected} current={Current}",
                business.PublicId,
                msg.ExpectedRevision,
                business.Revision);
            return;
        }

        if (msg.ExpectedRevision > business.Revision)
        {
            // Future revision relative to store — treat as unavailable context, do not fabricate.
            business.LastError = "enrichment_revision_ahead";
            return;
        }

        var cell = await enrichmentProvider.LookupAsync(msg.TenantId, business.PublicId, ct);
        var enrichment = new
        {
            status = cell.Status.ToString().ToLowerInvariant(),
            value = cell.Value,
            reason = cell.Reason,
            provenance = cell.Provenance,
            appliedAt = DateTimeOffset.UtcNow
        };

        business.EnrichmentJson = JsonSerializer.Serialize(enrichment);
        business.State = PipelineStates.Enriched;
        business.EnrichedAt = DateTimeOffset.UtcNow;
        business.Revision += 1;
        business.LastError = cell.Status is EvidenceStatus.Unavailable or EvidenceStatus.Unknown
            ? cell.Reason
            : null;

        // Enqueue evaluation against the new revision.
        db.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            TenantId = msg.TenantId,
            BusinessEventId = business.Id,
            MessageType = "evaluate",
            PayloadJson = "{}",
            Status = OutboxStatuses.Pending,
            AttemptCount = 0,
            NextAttemptAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpectedRevision = business.Revision,
            IdempotencyKey = $"evaluate:{business.PublicId}:r{business.Revision}"
        });
    }

    private async Task ApplyEvaluationAsync(OutboxMessage msg, CancellationToken ct)
    {
        var business = await db.PipelineEvents.FirstAsync(e => e.Id == msg.BusinessEventId, ct);

        if (msg.ExpectedRevision < business.Revision)
        {
            logger.LogInformation(
                "stale_evaluation_skipped event={EventId} expected={Expected} current={Current}",
                business.PublicId,
                msg.ExpectedRevision,
                business.Revision);
            return;
        }

        using var baselineDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(business.BaselineJson) ? "{}" : business.BaselineJson);
        var baselineStatus = baselineDoc.RootElement.TryGetProperty("Status", out var s)
            ? s.GetString()
            : baselineDoc.RootElement.TryGetProperty("status", out var s2) ? s2.GetString() : "unknown";

        // Never convert partial/unavailable enrichment into a hard negative.
        string decision;
        string evalStatus;
        if (baselineStatus is "insufficient_evidence" or "rejected")
        {
            evalStatus = baselineStatus == "rejected" ? "rejected" : "insufficient_evidence";
            decision = "observe";
        }
        else if (string.IsNullOrWhiteSpace(business.EnrichmentJson))
        {
            evalStatus = "insufficient_evidence";
            decision = "observe";
        }
        else
        {
            using var enrichDoc = JsonDocument.Parse(business.EnrichmentJson);
            var enrichStatus = enrichDoc.RootElement.TryGetProperty("status", out var es) ? es.GetString() : "unknown";
            if (enrichStatus is "unavailable" or "unknown" or "unsupported")
            {
                evalStatus = "insufficient_evidence";
                decision = "observe";
            }
            else
            {
                evalStatus = "evaluated";
                decision = "observe";
            }
        }

        business.EvaluationJson = JsonSerializer.Serialize(new
        {
            status = evalStatus,
            decision,
            revision = business.Revision,
            evaluatedAt = DateTimeOffset.UtcNow
        });
        business.State = PipelineStates.Evaluated;
        business.EvaluatedAt = DateTimeOffset.UtcNow;
        business.Revision += 1;
    }

    private static string Sanitize(string message) =>
        message.Length <= 200 ? message : message[..200];
}
