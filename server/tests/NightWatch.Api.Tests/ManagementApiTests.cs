using NightWatch.Modules.Admin;

namespace NightWatch.Api.Tests;

public class ManagementApiTests
{
    [Fact]
    public void Mutations_audit_and_block_cross_tenant()
    {
        var svc = new ManagementApiService();
        var (cStatus, createdObj) = svc.CreateProject("ten_a", "Web", "admin1", AdminRole.Administrator);
        Assert.Equal(201, cStatus);
        var created = Assert.IsType<ManagedProject>(createdObj);

        var patch = svc.PatchProject("ten_a", created.ProjectId, "Web2", 120, created.Revision, "admin1", AdminRole.Administrator);
        Assert.Equal(200, patch.Status);

        var cross = svc.PatchProject("ten_b", created.ProjectId, "Hack", null, 2, "evil", AdminRole.Administrator);
        Assert.Equal(404, cross.Status);

        var analystDenied = svc.CreateProject("ten_a", "Nope", "a1", AdminRole.Analyst);
        Assert.Equal(403, analystDenied.Status);

        var audit = svc.ListAudit("ten_a");
        Assert.Equal(2, audit.Count);
        Assert.All(audit, a => Assert.StartsWith("sha256:", a.Signature));
        Assert.Equal(ManagementApiService.ApiVersion, audit[0].ApiVersion);

        // compat constant remains for deprecation tests
        Assert.Equal("management-v0-compat", ManagementApiService.DeprecatedAlias);
    }
}
