namespace NightWatch.Modules.Admin;

/// <summary>Optional sink for dual-writing signed management audit to durable store (EF/Postgres).</summary>
public interface IAdminAuditSink
{
    void Write(SignedAuditEvent entry);
}

public sealed class NullAdminAuditSink : IAdminAuditSink
{
    public void Write(SignedAuditEvent entry) { }
}
