using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using NightWatch.Persistence.Retention;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace NightWatch.Api.Tests;

public class IdentityEventSchemaTests
{
    private static async Task<(ProPlusDbContext Db, Guid TenantId, Guid ProjectId, Guid EnvId)> SeedTenancyAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ProPlusDbContext>().UseSqlite(connection).Options;
        var db = new ProPlusDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var tenantId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            PublicId = "ten_evt",
            Name = "Events",
            DefaultRetentionDays = 90
        });
        db.Projects.Add(new Project
        {
            Id = projectId,
            PublicId = "prj_evt",
            TenantId = tenantId,
            Name = "Web"
        });
        db.Environments.Add(new EnvironmentEntity
        {
            Id = envId,
            PublicId = "env_evt",
            TenantId = tenantId,
            ProjectId = projectId,
            Name = "dev"
        });
        await db.SaveChangesAsync();
        return (db, tenantId, projectId, envId);
    }

    [Fact]
    public async Task Seeded_event_query_keeps_legacy_hash_separate_from_server_visitor()
    {
        var (db, tenantId, projectId, envId) = await SeedTenancyAsync();
        await using (db)
        {
            var visitorId = Guid.NewGuid();
            var eventId = Guid.NewGuid();
            const string legacyHash = "c5e055512be85b8798fe5d3240b2a04e";
            var created = DateTimeOffset.Parse("2026-11-03T12:00:00Z");

            db.Visitors.Add(new Visitor
            {
                Id = visitorId,
                PublicId = "v_01JSERVERVISITOR",
                TenantId = tenantId,
                ProjectId = projectId,
                FirstSeenAt = created,
                LastSeenAt = created
            });
            db.VisitorAliases.Add(new VisitorAlias
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                VisitorId = visitorId,
                AliasKind = "legacy_browser_hash",
                AliasValue = legacyHash
            });
            db.IdentificationEvents.Add(new IdentificationEvent
            {
                Id = eventId,
                PublicId = "ev_01JEXAMPLEEVENT1",
                TenantId = tenantId,
                ProjectId = projectId,
                EnvironmentId = envId,
                VisitorId = visitorId,
                LegacyBrowserVisitorId = legacyHash,
                MatchType = "new",
                IdentityOutcome = "new",
                CreatedAt = created,
                RetainUntil = EventRetention.ComputeRetainUntil(created, 90),
                Region = "ir-central"
            });
            db.SignalObservations.Add(new SignalObservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EventId = eventId,
                SignalId = "vpn",
                Status = "unknown",
                ValueJson = null,
                Confidence = null,
                Provenance = "offline_ip_feed",
                SourceQuality = "unknown"
            });
            db.EvidenceRecords.Add(new EvidenceRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EventId = eventId,
                EvidenceKind = "legacy_components_minimized",
                Status = "known",
                PayloadJson = "{\"keys\":2}",
                Provenance = "browser_sdk"
            });
            db.CollectorFailures.Add(new CollectorFailure
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EventId = eventId,
                SourceName = "domBlockers",
                ErrorKind = "error",
                SafeMessage = "timeout",
                DurationMs = 50
            });
            db.EventDecisions.Add(new EventDecision
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EventId = eventId,
                Status = "insufficient_evidence",
                Decision = "observe",
                PolicyVersion = "1",
                Score = null
            });
            await db.SaveChangesAsync();

            var ev = await db.IdentificationEvents
                .Include(e => e.Signals)
                .Include(e => e.Decision)
                .SingleAsync(e => e.PublicId == "ev_01JEXAMPLEEVENT1");

            Assert.Equal("v_01JSERVERVISITOR", (await db.Visitors.SingleAsync()).PublicId);
            Assert.Equal(legacyHash, ev.LegacyBrowserVisitorId);
            Assert.NotEqual(ev.LegacyBrowserVisitorId, (await db.Visitors.SingleAsync()).PublicId);
            Assert.Equal("unknown", ev.Signals.Single().Status);
            Assert.Null(ev.Decision!.Score);
            Assert.Equal("observe", ev.Decision.Decision);
        }
    }

    [Fact]
    public async Task Visitor_history_orders_by_created_at_desc()
    {
        var (db, tenantId, projectId, envId) = await SeedTenancyAsync();
        await using (db)
        {
            var visitorId = Guid.NewGuid();
            db.Visitors.Add(new Visitor
            {
                Id = visitorId,
                PublicId = "v_hist",
                TenantId = tenantId,
                ProjectId = projectId,
                FirstSeenAt = DateTimeOffset.Parse("2026-11-01T00:00:00Z"),
                LastSeenAt = DateTimeOffset.Parse("2026-11-03T00:00:00Z")
            });
            db.IdentificationEvents.AddRange(
                new IdentificationEvent
                {
                    Id = Guid.NewGuid(),
                    PublicId = "ev_old",
                    TenantId = tenantId,
                    ProjectId = projectId,
                    EnvironmentId = envId,
                    VisitorId = visitorId,
                    MatchType = "new",
                    IdentityOutcome = "new",
                    CreatedAt = DateTimeOffset.Parse("2026-11-01T00:00:00Z"),
                    RetainUntil = DateTimeOffset.Parse("2026-12-01T00:00:00Z")
                },
                new IdentificationEvent
                {
                    Id = Guid.NewGuid(),
                    PublicId = "ev_new",
                    TenantId = tenantId,
                    ProjectId = projectId,
                    EnvironmentId = envId,
                    VisitorId = visitorId,
                    MatchType = "matched",
                    IdentityOutcome = "matched",
                    CreatedAt = DateTimeOffset.Parse("2026-11-03T00:00:00Z"),
                    RetainUntil = DateTimeOffset.Parse("2026-12-03T00:00:00Z")
                });
            await db.SaveChangesAsync();

            var history = await EventRetention.VisitorHistoryAsync(db, tenantId, visitorId);
            Assert.Equal(2, history.Count);
            Assert.Equal("ev_new", history[0].PublicId);
            Assert.Equal("ev_old", history[1].PublicId);
        }
    }

    [Fact]
    public async Task Retention_marks_expired_events_safely()
    {
        var (db, tenantId, projectId, envId) = await SeedTenancyAsync();
        await using (db)
        {
            var visitorId = Guid.NewGuid();
            db.Visitors.Add(new Visitor
            {
                Id = visitorId,
                PublicId = "v_ret",
                TenantId = tenantId,
                ProjectId = projectId,
                FirstSeenAt = DateTimeOffset.UtcNow.AddDays(-100),
                LastSeenAt = DateTimeOffset.UtcNow.AddDays(-100)
            });
            var created = DateTimeOffset.UtcNow.AddDays(-100);
            db.IdentificationEvents.Add(new IdentificationEvent
            {
                Id = Guid.NewGuid(),
                PublicId = "ev_expired",
                TenantId = tenantId,
                ProjectId = projectId,
                EnvironmentId = envId,
                VisitorId = visitorId,
                MatchType = "new",
                IdentityOutcome = "new",
                CreatedAt = created,
                RetainUntil = EventRetention.ComputeRetainUntil(created, 30)
            });
            await db.SaveChangesAsync();

            var now = DateTimeOffset.UtcNow;
            var count = await EventRetention.MarkExpiredForArchivalAsync(db, now);
            Assert.Equal(1, count);
            var expired = await EventRetention.ListExpiredEventsAsync(db, now);
            Assert.Contains(expired, e => e.PublicId == "ev_expired");
        }
    }

    [Fact]
    public void ComputeRetainUntil_rejects_invalid_days()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            EventRetention.ComputeRetainUntil(DateTimeOffset.UtcNow, 0));
    }
}
