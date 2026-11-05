using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Identity;

public sealed class ZeroTrustOptions
{
    public TimeSpan MaxReceiptAge { get; set; } = TimeSpan.FromMinutes(5);
    public string SigningKey { get; set; } = "night-watch-dev-zt-receipt-key";
}

public sealed record BrowserOpaqueResult(string EventId, string Mode);

public sealed record ServerVerifiedEvent(
    string EventId,
    string VisitorId,
    string ProjectId,
    string TenantId,
    string MatchType,
    DateTimeOffset IssuedAt,
    string Receipt);

public sealed record TransactionDecision(
    string Decision, // step_up | deny | allow_conditional
    string Reason,
    bool Approved,
    string? EventId);

public interface IZeroTrustVerificationService
{
    BrowserOpaqueResult ToBrowserOpaque(string eventId);
    ServerVerifiedEvent IssueVerifiedEvent(string eventId, string visitorId, string tenantId, string projectId, string matchType);
    TransactionDecision EvaluateProtectedTransaction(
        string? browserClaimedVisitorId,
        string? eventReceipt,
        string expectedProjectId,
        string businessAction,
        decimal amount);
}

public sealed class ZeroTrustVerificationService(ZeroTrustOptions? options = null) : IZeroTrustVerificationService
{
    private readonly ZeroTrustOptions _options = options ?? new ZeroTrustOptions();
    private readonly ConcurrentDictionary<string, ServerVerifiedEvent> _events = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, byte> _spentReceipts = new(StringComparer.Ordinal);

    public BrowserOpaqueResult ToBrowserOpaque(string eventId) =>
        new(eventId, "zero_trust_opaque_event_id_only");

    public ServerVerifiedEvent IssueVerifiedEvent(
        string eventId,
        string visitorId,
        string tenantId,
        string projectId,
        string matchType)
    {
        var issued = DateTimeOffset.UtcNow;
        var payload = JsonSerializer.Serialize(new
        {
            eventId,
            visitorId,
            tenantId,
            projectId,
            matchType,
            iat = issued.ToUnixTimeSeconds()
        });
        var b64 = B64(Encoding.UTF8.GetBytes(payload));
        var sig = B64(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_options.SigningKey), Encoding.UTF8.GetBytes(b64)));
        var receipt = $"zt1.{b64}.{sig}";
        var ev = new ServerVerifiedEvent(eventId, visitorId, projectId, tenantId, matchType, issued, receipt);
        _events[eventId] = ev;
        return ev;
    }

    public TransactionDecision EvaluateProtectedTransaction(
        string? browserClaimedVisitorId,
        string? eventReceipt,
        string expectedProjectId,
        string businessAction,
        decimal amount)
    {
        // Never authorize solely on client fingerprint / forged visitorId.
        _ = browserClaimedVisitorId;

        if (string.IsNullOrWhiteSpace(eventReceipt))
        {
            return new TransactionDecision("deny", "missing_server_receipt", false, null);
        }

        if (!TryParseReceipt(eventReceipt, out var parsed, out var code))
        {
            return new TransactionDecision("deny", code!, false, null);
        }

        if (!string.Equals(parsed.ProjectId, expectedProjectId, StringComparison.Ordinal))
        {
            return new TransactionDecision("deny", "project_binding_mismatch", false, parsed.EventId);
        }

        if (!_events.TryGetValue(parsed.EventId, out var trusted)
            || !string.Equals(trusted.Receipt, eventReceipt, StringComparison.Ordinal))
        {
            return new TransactionDecision("deny", "event_not_trusted", false, parsed.EventId);
        }

        var age = DateTimeOffset.UtcNow - trusted.IssuedAt;
        if (age > _options.MaxReceiptAge || age < TimeSpan.Zero)
        {
            return new TransactionDecision("deny", "receipt_stale", false, parsed.EventId);
        }

        // Business action binding — high-value / privileged never unconditional allow.
        // step_up does not consume the one-time receipt (caller may finish MFA then re-submit).
        if (string.Equals(businessAction, "checkout", StringComparison.OrdinalIgnoreCase) && amount >= 500_000m)
        {
            return new TransactionDecision("step_up", "high_value_requires_step_up", false, parsed.EventId);
        }

        if (string.Equals(businessAction, "admin_privilege", StringComparison.OrdinalIgnoreCase))
        {
            return new TransactionDecision("step_up", "privileged_action_requires_step_up", false, parsed.EventId);
        }

        if (!_spentReceipts.TryAdd(eventReceipt, 1))
        {
            return new TransactionDecision("deny", "receipt_replay", false, parsed.EventId);
        }

        // Conditional allow still not "fingerprint authorized" — soft continuity only.
        return new TransactionDecision("allow_conditional", "server_verified_event_fresh_once", true, parsed.EventId);
    }

    private bool TryParseReceipt(string receipt, out (string EventId, string VisitorId, string ProjectId) parsed, out string? code)
    {
        parsed = default;
        code = null;
        var parts = receipt.Split('.', 3);
        if (parts.Length != 3 || parts[0] != "zt1")
        {
            code = "receipt_malformed";
            return false;
        }

        var expect = B64(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_options.SigningKey), Encoding.UTF8.GetBytes(parts[1])));
        if (!FixedEq(expect, parts[2]))
        {
            code = "receipt_forged";
            return false;
        }

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(Pad(parts[1])));
            using var doc = JsonDocument.Parse(json);
            parsed = (
                doc.RootElement.GetProperty("eventId").GetString()!,
                doc.RootElement.GetProperty("visitorId").GetString()!,
                doc.RootElement.GetProperty("projectId").GetString()!);
            return true;
        }
        catch
        {
            code = "receipt_malformed";
            return false;
        }
    }

    private static string B64(byte[] d) => Convert.ToBase64String(d).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string Pad(string s)
    {
        var p = s.Replace('-', '+').Replace('_', '/');
        return (p.Length % 4) switch { 2 => p + "==", 3 => p + "=", _ => p };
    }

    private static bool FixedEq(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
