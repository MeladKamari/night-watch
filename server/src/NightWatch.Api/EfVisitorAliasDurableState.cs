using NightWatch.Modules.Identity.Matching;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

public sealed class EfVisitorAliasDurableState(
    IServiceScopeFactory scopes,
    ILogger<EfVisitorAliasDurableState> logger) : IVisitorAliasDurableSink
{
    public void Upsert(StoredVisitorAlias alias)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.VisitorAliasIndex.FirstOrDefault(x =>
                x.Namespace == alias.Namespace && x.AliasKind == alias.AliasKind && x.AliasValue == alias.AliasValue);
            if (row is null)
            {
                row = new VisitorAliasIndexRow { Id = Guid.NewGuid() };
                db.VisitorAliasIndex.Add(row);
            }

            row.TenantId = alias.TenantId;
            row.Namespace = alias.Namespace;
            row.AliasKind = alias.AliasKind;
            row.AliasValue = alias.AliasValue;
            row.VisitorId = alias.VisitorId;
            row.UpdatedAt = alias.UpdatedAt;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_visitor_alias_upsert_failed visitor={VisitorId}", alias.VisitorId);
        }
    }

    public IReadOnlyList<StoredVisitorAlias> LoadAll()
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            EnsureTable(db);
            return db.VisitorAliasIndex.AsNoTracking()
                .Select(r => new StoredVisitorAlias(
                    r.TenantId, r.Namespace, r.AliasKind, r.AliasValue, r.VisitorId, r.UpdatedAt))
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_visitor_alias_load_failed");
            return [];
        }
    }

    public void EnsureSchemaAndHydrate(IVisitorAliasStore store)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
        db.Database.EnsureCreated();
        EnsureTable(db);
        var rows = LoadAll();
        store.Hydrate(rows);
        logger.LogInformation("visitor_aliases_hydrated count={Count}", rows.Count);
    }

    private static void EnsureTable(ProPlusDbContext db)
    {
        var npgsql = db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
        if (npgsql)
        {
            db.Database.ExecuteSqlRaw(
                """
                CREATE TABLE IF NOT EXISTS visitor_alias_index (
                  "Id" uuid NOT NULL PRIMARY KEY,
                  "TenantId" varchar(128) NOT NULL,
                  "Namespace" varchar(256) NOT NULL,
                  "AliasKind" varchar(64) NOT NULL,
                  "AliasValue" varchar(128) NOT NULL,
                  "VisitorId" varchar(64) NOT NULL,
                  "UpdatedAt" timestamptz NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_visitor_alias_index_Namespace_AliasKind_AliasValue"
                  ON visitor_alias_index ("Namespace", "AliasKind", "AliasValue");
                """);
            return;
        }

        db.Database.ExecuteSqlRaw(
            """
            CREATE TABLE IF NOT EXISTS visitor_alias_index (
              Id TEXT NOT NULL PRIMARY KEY,
              TenantId TEXT NOT NULL,
              Namespace TEXT NOT NULL,
              AliasKind TEXT NOT NULL,
              AliasValue TEXT NOT NULL,
              VisitorId TEXT NOT NULL,
              UpdatedAt TEXT NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw(
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_visitor_alias_index_Namespace_AliasKind_AliasValue ON visitor_alias_index (Namespace, AliasKind, AliasValue);");
    }
}
