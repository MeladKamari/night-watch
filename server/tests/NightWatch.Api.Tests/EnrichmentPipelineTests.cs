using System.Text.Json;
using NightWatch.BuildingBlocks;
using NightWatch.Modules.Intelligence.Pipeline;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace NightWatch.Api.Tests;

public class EnrichmentPipelineTests
{
    private static async Task<(ProPlusDbContext Db, EnrichmentPipeline Pipeline, EnrichmentWorker Worker, TProvider Provider)>
        CreateAsync<TProvider>(TProvider provider)
        where TProvider : IAsyncEnrichmentProvider
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ProPlusDbContext>().UseSqlite(connection).Options;
        var db = new ProPlusDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var opts = new EnrichmentPipelineOptions
        {
            MaxAttempts = 5,
            InitialBackoff = TimeSpan.FromMilliseconds(1),
            BackoffFactor = 2
        };
        var pipeline = new EnrichmentPipeline(db, opts);
        var worker = new EnrichmentWorker(db, provider, NullLogger<EnrichmentWorker>.Instance, opts);
        return (db, pipeline, worker, provider);
    }

    [Fact]
    public async Task Crash_then_retry_yields_one_business_enrichment()
    {
        var (db, pipeline, worker, provider) = await CreateAsync(new CountingEnrichmentProvider());
        await using (db)
        {
            var accepted = await pipeline.AcceptAsync(new AcceptObservationInput(
                Guid.NewGuid(),
                ["canvas", "fonts", "audio", "webGlBasics", "timezone"],
                "fraud_prevention",
                null));

            var outbox = await db.OutboxMessages.SingleAsync(m => m.MessageType == "enrich");
            await worker.SimulateCrashAfterClaimAsync(outbox.Id);

            Assert.Equal(OutboxStatuses.Pending, (await db.OutboxMessages.FindAsync(outbox.Id))!.Status);
            Assert.Equal(0, await db.InboxReceipts.CountAsync());
            Assert.Equal(0, provider.Calls);

            await worker.ProcessPendingAsync(); // enrich
            await worker.ProcessPendingAsync(); // evaluate

            var business = await db.PipelineEvents.SingleAsync(e => e.PublicId == accepted.EventPublicId);
            Assert.Equal(PipelineStates.Evaluated, business.State);
            Assert.Equal(1, provider.Calls);
            Assert.Equal(1, await db.InboxReceipts.CountAsync(r => r.MessageKey.StartsWith("enrich:")));
            Assert.Equal(1, await db.OutboxMessages.CountAsync(m =>
                m.MessageType == "enrich" && m.Status == OutboxStatuses.Done));

            // Re-drive the same outbox row: inbox receipt must prevent a second provider call.
            var done = await db.OutboxMessages.SingleAsync(m => m.Id == outbox.Id);
            done.Status = OutboxStatuses.Pending;
            done.ProcessedAt = null;
            done.NextAttemptAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            await worker.ProcessPendingAsync();
            Assert.Equal(1, provider.Calls);
        }
    }

    [Fact]
    public async Task Out_of_order_enrichment_cannot_overwrite_newer_revision()
    {
        var (db, pipeline, worker, _) = await CreateAsync(new FixedEnrichmentProvider("from_stale_worker"));
        await using (db)
        {
            var accepted = await pipeline.AcceptAsync(new AcceptObservationInput(
                Guid.NewGuid(),
                ["canvas", "fonts", "audio", "webGlBasics", "timezone"],
                "fraud_prevention",
                null));

            var business = await db.PipelineEvents.SingleAsync(e => e.PublicId == accepted.EventPublicId);
            var staleOutbox = await db.OutboxMessages.SingleAsync(m => m.MessageType == "enrich");

            business.Revision = 5;
            business.State = PipelineStates.Enriched;
            business.EnrichmentJson = JsonSerializer.Serialize(new { status = "known", value = "authoritative_newer" });
            business.EnrichedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();

            await worker.ProcessPendingAsync();

            business = await db.PipelineEvents.SingleAsync(e => e.PublicId == accepted.EventPublicId);
            Assert.Equal(5, business.Revision);
            Assert.Contains("authoritative_newer", business.EnrichmentJson);
            Assert.DoesNotContain("from_stale_worker", business.EnrichmentJson!);

            var msg = await db.OutboxMessages.SingleAsync(m => m.Id == staleOutbox.Id);
            Assert.Equal(OutboxStatuses.Done, msg.Status);
        }
    }

    [Fact]
    public void Partial_dataset_baseline_is_insufficient_not_false_negative()
    {
        var snap = EnrichmentPipeline.EvaluateBaselineSync(new AcceptObservationInput(
            Guid.NewGuid(),
            ComponentKeys: ["canvas"],
            Purpose: "fraud_prevention",
            PartialSignals: new Dictionary<string, JsonElement>
            {
                ["vpn"] = JsonDocument.Parse("null").RootElement
            }));

        Assert.Equal("insufficient_evidence", snap.Status);
        Assert.Equal("observe", snap.DecisionHint);
    }

    private sealed class CountingEnrichmentProvider : IAsyncEnrichmentProvider
    {
        public int Calls { get; private set; }

        public Task<EvidenceCell<object?>> LookupAsync(Guid tenantId, string eventPublicId, CancellationToken ct = default)
        {
            Calls++;
            return Task.FromResult(Evidence.Known<object?>("ok", "test_provider", confidence: 0.5));
        }
    }

    private sealed class FixedEnrichmentProvider(string value) : IAsyncEnrichmentProvider
    {
        public Task<EvidenceCell<object?>> LookupAsync(Guid tenantId, string eventPublicId, CancellationToken ct = default) =>
            Task.FromResult(Evidence.Known<object?>(value, "test_provider"));
    }
}
