namespace NightWatch.Modules.Admin;

/// <summary>Optional durable mirror for in-memory API credentials (Postgres/SQLite via API host).</summary>
public interface IApiCredentialDurableSink
{
    void Upsert(ApiCredentialRecord record);
    void MarkRevoked(string tenantId, string keyId, DateTimeOffset revokedAt);
}

public sealed class NullApiCredentialDurableSink : IApiCredentialDurableSink
{
    public void Upsert(ApiCredentialRecord record) { }
    public void MarkRevoked(string tenantId, string keyId, DateTimeOffset revokedAt) { }
}

public interface IManagementProjectDurableSink
{
    void Upsert(ManagedProject project);
}

public sealed class NullManagementProjectDurableSink : IManagementProjectDurableSink
{
    public void Upsert(ManagedProject project) { }
}
