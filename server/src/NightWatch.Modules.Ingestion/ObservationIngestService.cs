using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NightWatch.BuildingBlocks;
using NightWatch.BuildingBlocks.Caching;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Ingestion;

public sealed class ObservationIngestOptions
{
    public int MaxBodyBytes { get; set; } = 64 * 1024;
    public TimeSpan MaxClockSkew { get; set; } = TimeSpan.FromMinutes(5);
    public TimeSpan NonceTtl { get; set; } = TimeSpan.FromMinutes(10);
    public int RateLimitPerMinute { get; set; } = 120;
    public HashSet<string> AllowedOrigins { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        "https://example.ir",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    };
    public HashSet<string> AllowedPurposes { get; set; } = new(StringComparer.Ordinal)
    {
        "fraud_prevention",
        "account_security",
        "lab_inventory"
    };
}

public interface IObservationIngestService
{
    Task<(int StatusCode, object Body)> IngestAsync(
        ObservationIngestRequest? body,
        string? contentType,
        long? contentLength,
        string? origin,
        string? idempotencyHeader,
        string? correlationId,
        CancellationToken ct = default);
}

public sealed class ObservationIngestService(
    IngestDeduper deduper,
    ILogger<ObservationIngestService> logger,
    ObservationIngestOptions? options = null) : IObservationIngestService
{
    private readonly ObservationIngestOptions _options = options ?? new ObservationIngestOptions();
    private readonly ConcurrentDictionary<string, (int Count, DateTimeOffset WindowStart)> _rate = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _nonces = new();
    private readonly ConcurrentDictionary<string, string> _pgIdempotency = new();

    public async Task<(int StatusCode, object Body)> IngestAsync(
        ObservationIngestRequest? body,
        string? contentType,
        long? contentLength,
        string? origin,
        string? idempotencyHeader,
        string? correlationId,
        CancellationToken ct = default)
    {
        correlationId ??= "corr_" + Guid.NewGuid().ToString("N")[..16];

        if (contentLength is > 0 && contentLength > _options.MaxBodyBytes)
        {
            return Problem(413, "payload_too_large", "Payload exceeds maximum size", correlationId);
        }

        if (string.IsNullOrWhiteSpace(contentType)
            || contentType.Split(';')[0].Trim().ToLowerInvariant() is not ("application/json" or "application/*+json"))
        {
            return Problem(415, "unsupported_media_type", "Content-Type must be application/json", correlationId);
        }

        if (body is null)
        {
            return Problem(400, "invalid_json", "Request body required", correlationId);
        }

        if (!string.IsNullOrWhiteSpace(origin) && !_options.AllowedOrigins.Contains(origin))
        {
            return Problem(403, "origin_forbidden", "Origin is not allowlisted", correlationId);
        }

        // Rate limit by origin or anonymous bucket (no secrets logged).
        var rateKey = string.IsNullOrWhiteSpace(origin) ? "anon" : origin;
        if (!TryRate(rateKey))
        {
            return Problem(429, "rate_limited", "Too many requests", correlationId);
        }

        var validation = ValidateBody(body);
        if (validation is not null)
        {
            return Problem(400, validation.Value.Code, validation.Value.Detail, correlationId);
        }

        var idem = idempotencyHeader ?? body.IdempotencyKey!;
        if (string.IsNullOrWhiteSpace(idem) || idem.Length < 8 || idem.Length > 128)
        {
            return Problem(400, "idempotency_required", "Idempotency-Key header or body field required (8-128 chars)", correlationId);
        }

        if (!string.IsNullOrWhiteSpace(body.Nonce))
        {
            if (!_nonces.TryAdd(body.Nonce, DateTimeOffset.UtcNow.Add(_options.NonceTtl)))
            {
                return Problem(409, "replay_detected", "Nonce was already used", correlationId);
            }
        }

        // Never treat client visitor/risk/IP as authoritative — log only safe fields.
        logger.LogInformation(
            "ingest_accepted_path correlation={CorrelationId} purpose={Purpose} consent={Consent} hasLegacyHash={HasLegacy} ignoredClientAuthority=true",
            correlationId,
            body.Purpose,
            body.ConsentStatus,
            !string.IsNullOrWhiteSpace(body.LegacyBrowser?.VisitorId));

        var eventId = "ev_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
        var tenant = string.IsNullOrWhiteSpace(body.TenantHint) ? "tenant_default" : body.TenantHint!;
        var env = string.IsNullOrWhiteSpace(body.ProjectHint) ? "env_default" : body.ProjectHint!;

        var dedup = await deduper.RegisterAsync(
            tenant,
            env,
            idem,
            eventId,
            key =>
            {
                _pgIdempotency.TryGetValue($"{tenant}:{env}:{key}", out var existing);
                return Task.FromResult(existing);
            },
            ct: ct);

        if (dedup.Outcome == IngestDedupOutcome.Duplicate)
        {
            return (200, new ObservationIngestAccepted
            {
                EventId = dedup.EventPublicId,
                Status = "duplicate",
                CorrelationId = correlationId,
                ProcessingVersion = ProductIdentity.ProcessingVersion,
                ServerTime = DateTimeOffset.UtcNow.ToString("O"),
                Duplicate = true
            });
        }

        _pgIdempotency[$"{tenant}:{env}:{idem}"] = dedup.EventPublicId;

        var statusCode = dedup.Outcome == IngestDedupOutcome.CacheUnavailableUsePostgres ? 202 : 202;
        return (statusCode, new ObservationIngestAccepted
        {
            EventId = dedup.EventPublicId,
            Status = "accepted",
            CorrelationId = correlationId,
            ProcessingVersion = ProductIdentity.ProcessingVersion,
            ServerTime = DateTimeOffset.UtcNow.ToString("O"),
            Duplicate = false
        });
    }

    private (string Code, string Detail)? ValidateBody(ObservationIngestRequest body)
    {
        if (body.SchemaVersion != "night-watch-observation-v1")
        {
            return ("schema_version_invalid", "schemaVersion must be night-watch-observation-v1");
        }

        if (body.ProductCode != ProductIdentity.ProductCode)
        {
            return ("product_code_invalid", "productCode mismatch");
        }

        if (string.IsNullOrWhiteSpace(body.Purpose) || !_options.AllowedPurposes.Contains(body.Purpose))
        {
            return ("purpose_invalid", "purpose missing or not configured");
        }

        if (body.ConsentStatus is not ("granted" or "denied" or "unknown" or "not_required"))
        {
            return ("consent_invalid", "consentStatus invalid");
        }

        if (body.ConsentStatus == "denied")
        {
            return ("consent_denied", "consent denied");
        }

        if (!DateTimeOffset.TryParse(body.CollectedAt, out var collected))
        {
            return ("collected_at_invalid", "collectedAt must be RFC3339");
        }

        var skew = DateTimeOffset.UtcNow - collected.ToUniversalTime();
        if (skew.Duration() > _options.MaxClockSkew)
        {
            return ("clock_skew", "collectedAt outside allowed skew");
        }

        var legacy = body.LegacyBrowser;
        if (legacy is null)
        {
            return ("legacy_browser_required", "legacyBrowser required");
        }

        if (string.IsNullOrWhiteSpace(legacy.VisitorId)
            || legacy.VisitorId.Length != 32
            || !System.Text.RegularExpressions.Regex.IsMatch(legacy.VisitorId, "^[0-9a-f]{32}$"))
        {
            return ("legacy_visitor_invalid", "legacyBrowser.visitorId must be 32-char hex");
        }

        if (legacy.SourceManifestRevision != ProductIdentity.LegacySourceManifestRevision)
        {
            return ("source_manifest_invalid", "legacy sourceManifestRevision must be default-v1");
        }

        if (legacy.ComponentKeys is null)
        {
            return ("component_keys_required", "componentKeys required");
        }

        if (legacy.ComponentKeys.Count > 64)
        {
            return ("component_keys_oversized", "componentKeys exceeds max");
        }

        if (legacy.ComponentKeys.Contains("applePay", StringComparer.Ordinal))
        {
            return ("apple_pay_forbidden", "applePay is excluded");
        }

        // Client-submitted authoritative claims are rejected if they try to override via dedicated fields
        // (values may be present but are never used for identity/risk authority).
        _ = body.ClientIp;
        _ = body.ClientRiskScore;
        _ = body.ClientConfidence;
        _ = body.ClientVisitorId;

        return null;
    }

    private bool TryRate(string key)
    {
        var now = DateTimeOffset.UtcNow;
        var entry = _rate.AddOrUpdate(
            key,
            _ => (1, now),
            (_, prev) =>
            {
                if (now - prev.WindowStart > TimeSpan.FromMinutes(1))
                {
                    return (1, now);
                }

                return (prev.Count + 1, prev.WindowStart);
            });
        return entry.Count <= _options.RateLimitPerMinute;
    }

    private static (int, object) Problem(int status, string code, string detail, string correlationId) =>
        (status, new ProblemDetailsBody
        {
            Type = $"https://night-watch.local/problems/{code}",
            Title = code,
            Status = status,
            Code = code,
            Detail = detail,
            Instance = correlationId
        });
}
