using System.Text.Json;
using NightWatch.Modules.Identity.Matching;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

/// <summary>EF dual-write / hydrate for visitor device vectors (identify stability).</summary>
public sealed class EfDeviceVectorDurableState(
    IServiceScopeFactory scopes,
    ILogger<EfDeviceVectorDurableState> logger) : IDeviceVectorDurableSink
{
    public void Upsert(StoredDeviceVector vector)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.VisitorDeviceVectors
                .FirstOrDefault(x => x.TenantId == vector.TenantId && x.VisitorId == vector.VisitorId);
            if (row is null)
            {
                row = new VisitorDeviceVectorRow
                {
                    Id = Guid.NewGuid(),
                    TenantId = vector.TenantId,
                    VisitorId = vector.VisitorId
                };
                db.VisitorDeviceVectors.Add(row);
            }

            row.Namespace = vector.Namespace;
            row.ContinuityId = vector.ContinuityId;
            row.BlockKey = vector.BlockKey;
            row.FeaturesJson = DeviceVectorStore.SerializeFeatures(vector.Features);
            row.VectorVersion = vector.VectorVersion;
            row.ObservedAt = vector.ObservedAt;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_device_vector_upsert_failed visitor={VisitorId}", vector.VisitorId);
        }
    }

    public IReadOnlyList<StoredDeviceVector> LoadAll()
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            EnsureTable(db);
            return db.VisitorDeviceVectors.AsNoTracking()
                .Select(r => new StoredDeviceVector(
                    r.TenantId,
                    r.Namespace,
                    r.VisitorId,
                    r.ContinuityId,
                    r.BlockKey,
                    DeviceVectorStore.DeserializeFeatures(r.FeaturesJson),
                    r.ObservedAt,
                    r.VectorVersion))
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_device_vector_load_failed");
            return [];
        }
    }

    public void EnsureSchemaAndHydrate(IDeviceVectorStore store, ICandidateRetrievalService candidates)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
        db.Database.EnsureCreated();
        EnsureTable(db);

        var rows = db.VisitorDeviceVectors.AsNoTracking().ToList();
        var vectors = rows.Select(r => new StoredDeviceVector(
            r.TenantId,
            r.Namespace,
            r.VisitorId,
            r.ContinuityId,
            r.BlockKey,
            DeviceVectorStore.DeserializeFeatures(r.FeaturesJson),
            r.ObservedAt,
            r.VectorVersion)).ToList();

        store.Hydrate(vectors);
        foreach (var v in vectors)
        {
            candidates.Upsert(new IndexedVisitor
            {
                TenantId = v.TenantId,
                VisitorId = v.VisitorId,
                ContinuityId = v.ContinuityId,
                BlockKey = v.BlockKey
            });
        }

        logger.LogInformation("device_vectors_hydrated count={Count}", vectors.Count);
    }

    private static void EnsureTable(ProPlusDbContext db)
    {
        var npgsql = db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
        if (npgsql)
        {
            db.Database.ExecuteSqlRaw(
                """
                CREATE TABLE IF NOT EXISTS visitor_device_vectors (
                  "Id" uuid NOT NULL PRIMARY KEY,
                  "TenantId" varchar(128) NOT NULL,
                  "Namespace" varchar(256) NOT NULL,
                  "VisitorId" varchar(64) NOT NULL,
                  "ContinuityId" varchar(64) NULL,
                  "BlockKey" varchar(128) NULL,
                  "FeaturesJson" text NOT NULL,
                  "VectorVersion" varchar(64) NOT NULL,
                  "ObservedAt" timestamptz NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_visitor_device_vectors_TenantId_VisitorId"
                  ON visitor_device_vectors ("TenantId", "VisitorId");
                """);
            return;
        }

        db.Database.ExecuteSqlRaw(
            """
            CREATE TABLE IF NOT EXISTS visitor_device_vectors (
              Id TEXT NOT NULL PRIMARY KEY,
              TenantId TEXT NOT NULL,
              Namespace TEXT NOT NULL,
              VisitorId TEXT NOT NULL,
              ContinuityId TEXT NULL,
              BlockKey TEXT NULL,
              FeaturesJson TEXT NOT NULL,
              VectorVersion TEXT NOT NULL,
              ObservedAt TEXT NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw(
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_visitor_device_vectors_TenantId_VisitorId ON visitor_device_vectors (TenantId, VisitorId);");
    }
}
