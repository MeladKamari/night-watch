using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace NightWatch.Modules.Identity;

public sealed record IdentifyChallengeTicket(
    string ChallengeNonce,
    string TenantId,
    string ProjectId,
    DateTimeOffset ExpiresAt,
    int TtlSeconds);

public interface IIdentifyChallengeService
{
    IdentifyChallengeTicket Issue(string tenantId, string projectId);
    bool TryConsume(string tenantId, string projectId, string? challengeNonce, out string code, out string detail);
}

/// <summary>One-time identify challenge/nonce store (in-process; anti-replay for raw identify spam).</summary>
public sealed class IdentifyChallengeService : IIdentifyChallengeService
{
    private readonly ConcurrentDictionary<string, ChallengeEntry> _pending = new(StringComparer.Ordinal);
    private readonly TimeSpan _ttl;

    public IdentifyChallengeService(TimeSpan? ttl = null)
    {
        _ttl = ttl ?? TimeSpan.FromMinutes(5);
    }

    public IdentifyChallengeTicket Issue(string tenantId, string projectId)
    {
        Sweep();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var exp = DateTimeOffset.UtcNow.Add(_ttl);
        var key = Scope(tenantId, projectId, nonce);
        _pending[key] = new ChallengeEntry(tenantId.Trim(), projectId.Trim(), exp);
        return new IdentifyChallengeTicket(
            nonce,
            tenantId.Trim(),
            projectId.Trim(),
            exp,
            (int)_ttl.TotalSeconds);
    }

    public bool TryConsume(string tenantId, string projectId, string? challengeNonce, out string code, out string detail)
    {
        Sweep();
        if (string.IsNullOrWhiteSpace(challengeNonce)
            || challengeNonce.Length is < 16 or > 128
            || !System.Text.RegularExpressions.Regex.IsMatch(challengeNonce, "^[0-9a-fA-F]+$"))
        {
            code = "challenge_required";
            detail = "challengeNonce required — call POST /v1/identify/challenge first";
            return false;
        }

        var key = Scope(tenantId, projectId, challengeNonce);
        if (!_pending.TryRemove(key, out var entry))
        {
            code = "challenge_invalid";
            detail = "challengeNonce unknown, expired, or already consumed";
            return false;
        }

        if (entry.ExpiresAt < DateTimeOffset.UtcNow)
        {
            code = "challenge_expired";
            detail = "challengeNonce expired";
            return false;
        }

        if (!string.Equals(entry.TenantId, tenantId.Trim(), StringComparison.Ordinal)
            || !string.Equals(entry.ProjectId, projectId.Trim(), StringComparison.Ordinal))
        {
            code = "challenge_scope_mismatch";
            detail = "challengeNonce was issued for a different tenant/project";
            return false;
        }

        code = string.Empty;
        detail = string.Empty;
        return true;
    }

    private void Sweep()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var kv in _pending)
        {
            if (kv.Value.ExpiresAt < now)
            {
                _pending.TryRemove(kv.Key, out _);
            }
        }
    }

    private static string Scope(string tenantId, string projectId, string nonce) =>
        $"{tenantId.Trim()}|{projectId.Trim()}|{nonce.Trim().ToLowerInvariant()}";

    private sealed record ChallengeEntry(string TenantId, string ProjectId, DateTimeOffset ExpiresAt);
}
