using NightWatch.Persistence;
using NightWatch.Persistence.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace NightWatch.Api.Tests;

public class TenancySchemaTests
{
    private static ProPlusDbContext CreateDb()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<ProPlusDbContext>()
            .UseSqlite(connection)
            .Options;
        var db = new ProPlusDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    [Fact]
    public async Task Migration_round_trip_creates_tenant_hierarchy()
    {
        await using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var envId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            PublicId = "ten_test1",
            Name = "Lab Tenant"
        });
        db.Projects.Add(new Project
        {
            Id = projectId,
            PublicId = "prj_test1",
            TenantId = tenantId,
            Name = "Web"
        });
        db.Environments.Add(new EnvironmentEntity
        {
            Id = envId,
            PublicId = "env_test1",
            TenantId = tenantId,
            ProjectId = projectId,
            Name = "dev"
        });
        db.Origins.Add(new OriginAllowlist
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EnvironmentId = envId,
            OriginPattern = "https://example.ir"
        });
        db.ApiKeys.Add(new ScopedApiKey
        {
            Id = Guid.NewGuid(),
            PublicId = "key_pub1",
            TenantId = tenantId,
            EnvironmentId = envId,
            KeyKind = "public_collect",
            KeyId = "kid_abc",
            PublicKeyMaterial = [1, 2, 3]
        });
        await db.SaveChangesAsync();

        Assert.Equal(1, await db.Tenants.CountAsync());
        Assert.Equal(1, await db.Projects.CountAsync());
        Assert.Equal(1, await db.ApiKeys.CountAsync());
    }

    [Fact]
    public async Task Tenant_filter_hides_other_tenant_rows()
    {
        await using var db = CreateDb();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        db.Tenants.AddRange(
            new Tenant { Id = a, PublicId = "ten_a", Name = "A" },
            new Tenant { Id = b, PublicId = "ten_b", Name = "B" });
        db.Projects.AddRange(
            new Project { Id = Guid.NewGuid(), PublicId = "prj_a", TenantId = a, Name = "A" },
            new Project { Id = Guid.NewGuid(), PublicId = "prj_b", TenantId = b, Name = "B" });
        await db.SaveChangesAsync();

        db.CurrentTenantId = a;
        var visible = await db.Projects.ToListAsync();
        Assert.Single(visible);
        Assert.Equal(a, visible[0].TenantId);
    }

    [Fact]
    public async Task Soft_delete_hides_tenant()
    {
        await using var db = CreateDb();
        var id = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = id, PublicId = "ten_soft", Name = "Soft" });
        await db.SaveChangesAsync();
        var tenant = await db.Tenants.SingleAsync();
        tenant.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        Assert.Empty(await db.Tenants.ToListAsync());
    }
}
