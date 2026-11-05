using System.Text.Json;
using NightWatch.Modules.Admin;
using NightWatch.Modules.Webhooks;
using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Dual-writes management keys / webhooks / projects to EF and hydrates in-memory stores on boot.
/// </summary>
public sealed class EfAdminDurableState(
    IServiceScopeFactory scopes,
    ILogger<EfAdminDurableState> logger) :
    IApiCredentialDurableSink,
    IWebhookDurableSink,
    IManagementProjectDurableSink
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public void Upsert(ApiCredentialRecord record)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.ManagementApiKeys.FirstOrDefault(x => x.KeyId == record.KeyId);
            if (row is null)
            {
                row = new ManagementApiKeyRow { Id = Guid.NewGuid(), KeyId = record.KeyId };
                db.ManagementApiKeys.Add(row);
            }

            row.PublicId = record.PublicId;
            row.TenantId = record.TenantId;
            row.EnvironmentId = record.EnvironmentId;
            row.Kind = record.Kind.ToString();
            row.Prefix = record.Prefix;
            row.SecretHash = record.SecretHash;
            row.ScopesJson = JsonSerializer.Serialize(record.Scopes.OrderBy(s => s).ToList(), JsonOpts);
            row.DomainsJson = JsonSerializer.Serialize(record.DomainAllowlist.OrderBy(s => s).ToList(), JsonOpts);
            row.QuotaPerMinute = record.QuotaPerMinute;
            row.TrustedIngestion = record.TrustedIngestion;
            row.Revoked = record.Revoked;
            row.RevokedAt = record.RevokedAt;
            row.CreatedAt = record.CreatedAt;
            row.RotatedAt = record.RotatedAt;
            row.UsageCount = record.UsageCount;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_api_key_upsert_failed keyId={KeyId}", record.KeyId);
        }
    }

    public void MarkRevoked(string tenantId, string keyId, DateTimeOffset revokedAt)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.ManagementApiKeys.FirstOrDefault(x => x.KeyId == keyId && x.TenantId == tenantId);
            if (row is null) return;
            row.Revoked = true;
            row.RevokedAt = revokedAt;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_api_key_revoke_failed keyId={KeyId}", keyId);
        }
    }

    public void Upsert(WebhookSubscription subscription)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.ManagementWebhookSubscriptions.FirstOrDefault(x => x.SubscriptionId == subscription.SubscriptionId);
            if (row is null)
            {
                row = new ManagementWebhookSubscriptionRow
                {
                    Id = Guid.NewGuid(),
                    SubscriptionId = subscription.SubscriptionId
                };
                db.ManagementWebhookSubscriptions.Add(row);
            }

            row.TenantId = subscription.TenantId;
            row.EnvironmentId = subscription.EnvironmentId;
            row.TargetUrl = subscription.TargetUrl;
            row.SigningSecret = subscription.SigningSecret;
            row.PreviousSigningSecret = subscription.PreviousSigningSecret;
            row.EventFiltersJson = JsonSerializer.Serialize(subscription.EventFilters.OrderBy(s => s).ToList(), JsonOpts);
            row.Enabled = subscription.Enabled;
            row.CreatedAt = subscription.CreatedAt;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_webhook_upsert_failed sub={Sub}", subscription.SubscriptionId);
        }
    }

    public void Upsert(ManagedProject project)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
            var row = db.ManagementProjects.FirstOrDefault(x =>
                x.TenantId == project.TenantId && x.ProjectId == project.ProjectId);
            if (row is null)
            {
                row = new ManagementProjectRow
                {
                    Id = Guid.NewGuid(),
                    TenantId = project.TenantId,
                    ProjectId = project.ProjectId
                };
                db.ManagementProjects.Add(row);
            }

            row.Name = project.Name;
            row.Revision = project.Revision;
            row.RetentionDays = project.RetentionDays;
            row.DomainPoliciesJson = JsonSerializer.Serialize(project.DomainPolicies, JsonOpts);
            row.WebhookIdsJson = JsonSerializer.Serialize(project.WebhookIds, JsonOpts);
            row.Deleted = project.Deleted;
            row.UpdatedAt = DateTimeOffset.UtcNow;
            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ef_project_upsert_failed projectId={ProjectId}", project.ProjectId);
        }
    }

    public void EnsureSchemaAndHydrate(
        ApiCredentialService keys,
        WebhookOutboundService webhooks,
        ManagementApiService projects)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProPlusDbContext>();
        db.Database.EnsureCreated();
        EnsureManagementTables(db);

        var keyRows = db.ManagementApiKeys.AsNoTracking().ToList();
        keys.Hydrate(keyRows.Select(r => new ApiCredentialRecord
        {
            KeyId = r.KeyId,
            PublicId = r.PublicId,
            TenantId = r.TenantId,
            EnvironmentId = r.EnvironmentId,
            Kind = Enum.TryParse<ApiKeyKind>(r.Kind, out var k) ? k : ApiKeyKind.Public,
            Prefix = r.Prefix,
            SecretHash = r.SecretHash,
            Scopes = DeserializeSet(r.ScopesJson),
            DomainAllowlist = DeserializeSet(r.DomainsJson),
            QuotaPerMinute = r.QuotaPerMinute,
            TrustedIngestion = r.TrustedIngestion,
            Revoked = r.Revoked,
            RevokedAt = r.RevokedAt,
            CreatedAt = r.CreatedAt,
            RotatedAt = r.RotatedAt,
            UsageCount = r.UsageCount
        }));

        var whRows = db.ManagementWebhookSubscriptions.AsNoTracking().ToList();
        webhooks.Hydrate(whRows.Select(r => new WebhookSubscription
        {
            SubscriptionId = r.SubscriptionId,
            TenantId = r.TenantId,
            EnvironmentId = r.EnvironmentId,
            TargetUrl = r.TargetUrl,
            SigningSecret = r.SigningSecret,
            PreviousSigningSecret = r.PreviousSigningSecret,
            EventFilters = DeserializeSet(r.EventFiltersJson),
            Enabled = r.Enabled,
            CreatedAt = r.CreatedAt
        }));

        var prRows = db.ManagementProjects.AsNoTracking().Where(p => !p.Deleted).ToList();
        projects.Hydrate(prRows.Select(r => new ManagedProject
        {
            ProjectId = r.ProjectId,
            TenantId = r.TenantId,
            Name = r.Name,
            Revision = r.Revision,
            RetentionDays = r.RetentionDays,
            DomainPolicies = DeserializeList(r.DomainPoliciesJson),
            WebhookIds = DeserializeList(r.WebhookIdsJson),
            Deleted = r.Deleted
        }));

        logger.LogInformation(
            "management_durable_hydrated keys={Keys} webhooks={Webhooks} projects={Projects}",
            keyRows.Count,
            whRows.Count,
            prRows.Count);
    }

    private void EnsureManagementTables(ProPlusDbContext db)
    {
        // EnsureCreated skips ALTER on existing lab DBs — add denormalized management mirrors if missing.
        var npgsql = db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
        try
        {
            if (npgsql)
            {
                db.Database.ExecuteSqlRaw(
                    """
                    CREATE TABLE IF NOT EXISTS management_api_keys (
                      "Id" uuid NOT NULL PRIMARY KEY,
                      "KeyId" varchar(64) NOT NULL,
                      "PublicId" text NOT NULL,
                      "TenantId" varchar(128) NOT NULL,
                      "EnvironmentId" text NOT NULL,
                      "Kind" text NOT NULL,
                      "Prefix" text NOT NULL,
                      "SecretHash" varchar(128) NOT NULL,
                      "ScopesJson" text NOT NULL,
                      "DomainsJson" text NOT NULL,
                      "QuotaPerMinute" integer NOT NULL,
                      "TrustedIngestion" boolean NOT NULL,
                      "Revoked" boolean NOT NULL,
                      "RevokedAt" timestamptz NULL,
                      "CreatedAt" timestamptz NOT NULL,
                      "RotatedAt" timestamptz NULL,
                      "UsageCount" bigint NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS "IX_management_api_keys_KeyId" ON management_api_keys ("KeyId");
                    CREATE TABLE IF NOT EXISTS management_webhook_subscriptions (
                      "Id" uuid NOT NULL PRIMARY KEY,
                      "SubscriptionId" varchar(64) NOT NULL,
                      "TenantId" text NOT NULL,
                      "EnvironmentId" text NOT NULL,
                      "TargetUrl" varchar(512) NOT NULL,
                      "SigningSecret" varchar(128) NOT NULL,
                      "PreviousSigningSecret" text NULL,
                      "EventFiltersJson" text NOT NULL,
                      "Enabled" boolean NOT NULL,
                      "CreatedAt" timestamptz NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS "IX_management_webhook_subscriptions_SubscriptionId"
                      ON management_webhook_subscriptions ("SubscriptionId");
                    CREATE TABLE IF NOT EXISTS management_projects (
                      "Id" uuid NOT NULL PRIMARY KEY,
                      "ProjectId" varchar(64) NOT NULL,
                      "TenantId" text NOT NULL,
                      "Name" varchar(200) NOT NULL,
                      "Revision" bigint NOT NULL,
                      "RetentionDays" integer NOT NULL,
                      "DomainPoliciesJson" text NOT NULL,
                      "WebhookIdsJson" text NOT NULL,
                      "Deleted" boolean NOT NULL,
                      "UpdatedAt" timestamptz NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS "IX_management_projects_TenantId_ProjectId"
                      ON management_projects ("TenantId", "ProjectId");
                    """);
            }
            else
            {
                db.Database.ExecuteSqlRaw(
                    """
                    CREATE TABLE IF NOT EXISTS management_api_keys (
                      Id TEXT NOT NULL PRIMARY KEY,
                      KeyId TEXT NOT NULL,
                      PublicId TEXT NOT NULL,
                      TenantId TEXT NOT NULL,
                      EnvironmentId TEXT NOT NULL,
                      Kind TEXT NOT NULL,
                      Prefix TEXT NOT NULL,
                      SecretHash TEXT NOT NULL,
                      ScopesJson TEXT NOT NULL,
                      DomainsJson TEXT NOT NULL,
                      QuotaPerMinute INTEGER NOT NULL,
                      TrustedIngestion INTEGER NOT NULL,
                      Revoked INTEGER NOT NULL,
                      RevokedAt TEXT NULL,
                      CreatedAt TEXT NOT NULL,
                      RotatedAt TEXT NULL,
                      UsageCount INTEGER NOT NULL
                    );
                    """);
                db.Database.ExecuteSqlRaw(
                    "CREATE UNIQUE INDEX IF NOT EXISTS IX_management_api_keys_KeyId ON management_api_keys (KeyId);");
                db.Database.ExecuteSqlRaw(
                    """
                    CREATE TABLE IF NOT EXISTS management_webhook_subscriptions (
                      Id TEXT NOT NULL PRIMARY KEY,
                      SubscriptionId TEXT NOT NULL,
                      TenantId TEXT NOT NULL,
                      EnvironmentId TEXT NOT NULL,
                      TargetUrl TEXT NOT NULL,
                      SigningSecret TEXT NOT NULL,
                      PreviousSigningSecret TEXT NULL,
                      EventFiltersJson TEXT NOT NULL,
                      Enabled INTEGER NOT NULL,
                      CreatedAt TEXT NOT NULL
                    );
                    """);
                db.Database.ExecuteSqlRaw(
                    "CREATE UNIQUE INDEX IF NOT EXISTS IX_management_webhook_subscriptions_SubscriptionId ON management_webhook_subscriptions (SubscriptionId);");
                db.Database.ExecuteSqlRaw(
                    """
                    CREATE TABLE IF NOT EXISTS management_projects (
                      Id TEXT NOT NULL PRIMARY KEY,
                      ProjectId TEXT NOT NULL,
                      TenantId TEXT NOT NULL,
                      Name TEXT NOT NULL,
                      Revision INTEGER NOT NULL,
                      RetentionDays INTEGER NOT NULL,
                      DomainPoliciesJson TEXT NOT NULL,
                      WebhookIdsJson TEXT NOT NULL,
                      Deleted INTEGER NOT NULL,
                      UpdatedAt TEXT NOT NULL
                    );
                    """);
                db.Database.ExecuteSqlRaw(
                    "CREATE UNIQUE INDEX IF NOT EXISTS IX_management_projects_TenantId_ProjectId ON management_projects (TenantId, ProjectId);");
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "management_table_ensure_failed");
        }
    }

    private static HashSet<string> DeserializeSet(string json)
    {
        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
            return list.ToHashSet(StringComparer.Ordinal);
        }
        catch
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }
    }

    private static List<string> DeserializeList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
