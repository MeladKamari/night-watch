using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Admin;

public sealed record ConsoleUser(
    string UserId,
    string Username,
    string PasswordHash,
    string TenantId,
    AdminRole Role);

public sealed record ConsoleSession(
    string SessionId,
    string UserId,
    string Username,
    string TenantId,
    AdminRole Role,
    string CsrfToken,
    DateTimeOffset ExpiresAt);

public sealed record ConsoleLoginResponse(
    string SessionId,
    string CsrfToken,
    string UserId,
    string Username,
    string TenantId,
    string Role,
    DateTimeOffset ExpiresAt);

public interface IConsoleAuthService
{
    (int Status, object Body) Login(string username, string password);
    (int Status, object Body) Logout(string? sessionId);
    (bool Ok, ConsoleSession? Session, string? Code) ValidateSession(string? sessionId);
    (bool Ok, string? Code) ValidateCsrf(string? sessionId, string? csrfHeader);
    ConsoleSession? GetSession(string sessionId);
}

/// <summary>
/// Cookie-style session auth for admin console. Dev users only; passwords hashed; CSRF double-submit.
/// </summary>
public sealed class ConsoleAuthService : IConsoleAuthService
{
    public const string SessionCookieName = "ibf_console_session";
    public const string CsrfHeaderName = "X-CSRF-Token";
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(8);

    private readonly ConcurrentDictionary<string, ConsoleSession> _sessions = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, ConsoleUser> _users;

    public ConsoleAuthService()
    {
        _users = new ConcurrentDictionary<string, ConsoleUser>(StringComparer.OrdinalIgnoreCase)
        {
            ["admin"] = new ConsoleUser("u_admin", "admin", Hash("admin-change-me"), "tenant_demo", AdminRole.Administrator),
            ["analyst"] = new ConsoleUser("u_analyst", "analyst", Hash("analyst-change-me"), "tenant_demo", AdminRole.Analyst)
        };
    }

    public (int Status, object Body) Login(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return Problem(400, "invalid_request", "username and password required");
        }

        if (!_users.TryGetValue(username.Trim(), out var user) || !FixedEq(user.PasswordHash, Hash(password)))
        {
            return Problem(401, "invalid_credentials", "Invalid username or password");
        }

        var sessionId = "sess_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var csrf = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var session = new ConsoleSession(
            sessionId,
            user.UserId,
            user.Username,
            user.TenantId,
            user.Role,
            csrf,
            DateTimeOffset.UtcNow.Add(SessionTtl));
        _sessions[sessionId] = session;

        return (200, new ConsoleLoginResponse(
            sessionId,
            csrf,
            user.UserId,
            user.Username,
            user.TenantId,
            user.Role.ToString(),
            session.ExpiresAt));
    }

    public (int Status, object Body) Logout(string? sessionId)
    {
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            _sessions.TryRemove(sessionId, out _);
        }

        return (200, new { ok = true });
    }

    public (bool Ok, ConsoleSession? Session, string? Code) ValidateSession(string? sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return (false, null, "missing_session");
        if (!_sessions.TryGetValue(sessionId, out var s)) return (false, null, "unknown_session");
        if (s.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            _sessions.TryRemove(sessionId, out _);
            return (false, null, "session_expired");
        }

        return (true, s, null);
    }

    public (bool Ok, string? Code) ValidateCsrf(string? sessionId, string? csrfHeader)
    {
        var (ok, session, code) = ValidateSession(sessionId);
        if (!ok || session is null) return (false, code);
        if (string.IsNullOrWhiteSpace(csrfHeader) || csrfHeader.Length < 16) return (false, "csrf_missing");
        if (!FixedEq(session.CsrfToken, csrfHeader)) return (false, "csrf_mismatch");
        return (true, null);
    }

    public ConsoleSession? GetSession(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    /// <summary>Issue a session after MFA without re-checking password (lab/OIDC bridge).</summary>
    public ConsoleLoginResponse? IssueSessionForUser(string username)
    {
        if (!_users.TryGetValue(username.Trim(), out var user)) return null;
        var sessionId = "sess_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var csrf = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var session = new ConsoleSession(
            sessionId,
            user.UserId,
            user.Username,
            user.TenantId,
            user.Role,
            csrf,
            DateTimeOffset.UtcNow.Add(SessionTtl));
        _sessions[sessionId] = session;
        return new ConsoleLoginResponse(
            sessionId,
            csrf,
            user.UserId,
            user.Username,
            user.TenantId,
            user.Role.ToString(),
            session.ExpiresAt);
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("night-watch-console|" + value))).ToLowerInvariant();

    private static bool FixedEq(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    private static (int, object) Problem(int status, string code, string detail) =>
        (status, new Dictionary<string, object?>
        {
            ["type"] = $"https://night-watch.local/problems/{code}",
            ["title"] = code,
            ["status"] = status,
            ["code"] = code,
            ["detail"] = detail
        });
}
