using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace NightWatch.Modules.Webhooks;

public sealed class WebhookOptions
{
    public int MaxAttempts { get; set; } = 5;
    public TimeSpan InitialBackoff { get; set; } = TimeSpan.FromMilliseconds(25);
    public double BackoffFactor { get; set; } = 2.0;
    public int CircuitFailureThreshold { get; set; } = 3;
    public TimeSpan CircuitOpenDuration { get; set; } = TimeSpan.FromSeconds(30);
    public TimeSpan SignatureSkew { get; set; } = TimeSpan.FromMinutes(5);
}

public interface IWebhookOutboundService
{
    WebhookSubscription CreateSubscription(
        string tenantId,
        string environmentId,
        string targetUrl,
        IEnumerable<string> eventFilters);
    bool RotateSecret(string subscriptionId, out string? newSecret);
    string Enqueue(string subscriptionId, string eventType, object data);
    Task<int> ProcessPendingAsync(Func<WebhookDeliveryAttempt, Task<WebhookSendResult>>? transport = null, CancellationToken ct = default);
    bool ReplayDead(string deliveryId);
    IReadOnlyList<WebhookDeliveryRecord> ListDeliveries(string tenantId);
    WebhookSubscription? GetSubscription(string subscriptionId);
    IReadOnlyList<WebhookSubscription> ListSubscriptions(string tenantId, string? environmentId = null);
}

public sealed record WebhookDeliveryAttempt(
    string DeliveryId,
    string TargetUrl,
    string PayloadJson,
    string SignatureHeader,
    long TimestampUnix,
    IReadOnlyDictionary<string, string> Headers);

public sealed record WebhookSendResult(bool Success, int? StatusCode, string? Error);

public static class WebhookUrlValidator
{
    public static (bool Ok, string? Reason) Validate(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return (false, "invalid_url");
        }

        if (uri.Scheme is not ("https" or "http"))
        {
            return (false, "scheme_not_allowed");
        }

        // Lab allows http://127.0.0.1 for tests; block cloud metadata and link-local SSRF.
        var host = uri.Host;
        if (IPAddress.TryParse(host, out var ip))
        {
            if (IPAddress.IsLoopback(ip) && uri.Scheme == "http")
            {
                return (true, null); // explicit lab exception
            }

            if (IsPrivateOrLinkLocal(ip))
            {
                return (false, "ssrf_private_ip_blocked");
            }
        }
        else
        {
            var lower = host.ToLowerInvariant();
            if (lower is "metadata.google.internal" or "metadata" || lower.EndsWith(".internal", StringComparison.Ordinal))
            {
                return (false, "ssrf_metadata_host_blocked");
            }

            if (lower is "localhost" && uri.Scheme != "http")
            {
                return (false, "localhost_https_only_or_use_loopback_http_lab");
            }
        }

        if (uri.Scheme == "http" && !IPAddress.TryParse(host, out var loop) && !string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            return (false, "http_only_allowed_for_lab_loopback");
        }

        if (uri.Scheme == "http" && IPAddress.TryParse(host, out var lip) && !IPAddress.IsLoopback(lip)
            && !string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            return (false, "http_only_allowed_for_lab_loopback");
        }

        return (true, null);
    }

    private static bool IsPrivateOrLinkLocal(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip))
        {
            return false; // handled separately
        }

        var bytes = ip.GetAddressBytes();
        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            if (bytes[0] == 10) return true;
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
            if (bytes[0] == 192 && bytes[1] == 168) return true;
            if (bytes[0] == 169 && bytes[1] == 254) return true;
            if (bytes[0] == 127) return true;
        }

        return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal;
    }
}

public static class WebhookSigner
{
    public static string Sign(string secret, long timestampUnix, string body) =>
        "v1=" + Convert.ToHexString(
            HMACSHA256.HashData(
                Encoding.UTF8.GetBytes(secret),
                Encoding.UTF8.GetBytes($"{timestampUnix}.{body}"))).ToLowerInvariant();

    public static bool Verify(
        string secret,
        string? previousSecret,
        long timestampUnix,
        string body,
        string signatureHeader,
        TimeSpan skew,
        DateTimeOffset now,
        out string? rejectReason)
    {
        rejectReason = null;
        var age = now - DateTimeOffset.FromUnixTimeSeconds(timestampUnix);
        if (age.Duration() > skew)
        {
            rejectReason = "timestamp_skew_or_replay_window";
            return false;
        }

        var expected = Sign(secret, timestampUnix, body);
        if (FixedEquals(expected, signatureHeader))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(previousSecret))
        {
            var prev = Sign(previousSecret, timestampUnix, body);
            if (FixedEquals(prev, signatureHeader))
            {
                return true;
            }
        }

        rejectReason = "signature_mismatch";
        return false;
    }

    private static bool FixedEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}

/// <summary>Sample idempotent consumer — dedupes on deliveryId; rejects bad signatures / stale timestamps.</summary>
public sealed class SampleWebhookConsumer(string secret, string? previousSecret = null, TimeSpan? skew = null)
{
    private readonly HashSet<string> _seenDeliveryIds = new(StringComparer.Ordinal);
    private readonly TimeSpan _skew = skew ?? TimeSpan.FromMinutes(5);

    public (bool Accepted, string? Reason) Consume(string payloadJson, string signatureHeader, long timestampUnix, DateTimeOffset now)
    {
        if (!WebhookSigner.Verify(secret, previousSecret, timestampUnix, payloadJson, signatureHeader, _skew, now, out var reason))
        {
            return (false, reason);
        }

        using var doc = JsonDocument.Parse(payloadJson);
        var deliveryId = doc.RootElement.GetProperty("deliveryId").GetString()!;
        if (!_seenDeliveryIds.Add(deliveryId))
        {
            return (true, "duplicate_ignored_idempotent"); // at-least-once safe
        }

        return (true, null);
    }
}

public sealed class WebhookOutboundService(
    ILogger<WebhookOutboundService> logger,
    WebhookOptions? options = null,
    IWebhookDurableSink? durable = null) : IWebhookOutboundService
{
    private readonly WebhookOptions _options = options ?? new WebhookOptions();
    private readonly IWebhookDurableSink _durable = durable ?? new NullWebhookDurableSink();
    private readonly ConcurrentDictionary<string, WebhookSubscription> _subs = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, WebhookDeliveryRecord> _deliveries = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, (int Failures, DateTimeOffset? OpenUntil)> _circuits = new(StringComparer.Ordinal);

    public void Hydrate(IEnumerable<WebhookSubscription> subscriptions)
    {
        foreach (var s in subscriptions)
        {
            _subs[s.SubscriptionId] = s;
        }
    }

    public WebhookSubscription CreateSubscription(
        string tenantId,
        string environmentId,
        string targetUrl,
        IEnumerable<string> eventFilters)
    {
        var (ok, reason) = WebhookUrlValidator.Validate(targetUrl);
        if (!ok)
        {
            throw new InvalidOperationException(reason);
        }

        var filters = eventFilters.Where(WebhookEventTypes.All.Contains).ToHashSet(StringComparer.Ordinal);
        if (filters.Count == 0)
        {
            throw new InvalidOperationException("event_filters_required");
        }

        var sub = new WebhookSubscription
        {
            SubscriptionId = "whs_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId,
            EnvironmentId = environmentId,
            TargetUrl = targetUrl,
            SigningSecret = "whsec_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant(),
            EventFilters = filters
        };
        _subs[sub.SubscriptionId] = sub;
        _durable.Upsert(sub);
        return sub;
    }

    public bool RotateSecret(string subscriptionId, out string? newSecret)
    {
        newSecret = null;
        if (!_subs.TryGetValue(subscriptionId, out var sub))
        {
            return false;
        }

        sub.PreviousSigningSecret = sub.SigningSecret;
        sub.SigningSecret = "whsec_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        newSecret = sub.SigningSecret;
        _durable.Upsert(sub);
        return true;
    }

    public string Enqueue(string subscriptionId, string eventType, object data)
    {
        if (!_subs.TryGetValue(subscriptionId, out var sub) || !sub.Enabled)
        {
            throw new InvalidOperationException("subscription_unavailable");
        }

        if (!sub.EventFilters.Contains(eventType))
        {
            throw new InvalidOperationException("event_filtered_out");
        }

        var deliveryId = "whd_" + Guid.NewGuid().ToString("N")[..16];
        var envelope = new WebhookEnvelope
        {
            SchemaVersion = "night-watch-webhook-v1",
            EventType = eventType,
            DeliveryId = deliveryId,
            TenantId = sub.TenantId,
            EnvironmentId = sub.EnvironmentId,
            OccurredAt = DateTimeOffset.UtcNow.ToString("O"),
            Data = data
        };
        var payload = JsonSerializer.Serialize(envelope, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var sig = WebhookSigner.Sign(sub.SigningSecret, ts, payload);

        var rec = new WebhookDeliveryRecord
        {
            DeliveryId = deliveryId,
            SubscriptionId = subscriptionId,
            TenantId = sub.TenantId,
            EventType = eventType,
            PayloadJson = payload,
            Status = "pending",
            Attempts = 0,
            NextAttemptAt = DateTimeOffset.UtcNow,
            SignatureHeader = sig,
            TimestampUnix = ts
        };
        _deliveries[deliveryId] = rec;
        return deliveryId;
    }

    public async Task<int> ProcessPendingAsync(
        Func<WebhookDeliveryAttempt, Task<WebhookSendResult>>? transport = null,
        CancellationToken ct = default)
    {
        transport ??= _ => Task.FromResult(new WebhookSendResult(true, 200, null));
        var now = DateTimeOffset.UtcNow;
        var pending = _deliveries.Values
            .Where(d => d.Status == "pending" && (d.NextAttemptAt is null || d.NextAttemptAt <= now))
            .OrderBy(d => d.CreatedAt)
            .Take(32)
            .ToList();

        var n = 0;
        foreach (var d in pending)
        {
            ct.ThrowIfCancellationRequested();
            if (!_subs.TryGetValue(d.SubscriptionId, out var sub))
            {
                d.Status = "dead";
                d.LastError = "subscription_missing";
                continue;
            }

            if (_circuits.TryGetValue(sub.SubscriptionId, out var circuit)
                && circuit.OpenUntil is not null
                && circuit.OpenUntil > now)
            {
                d.Status = "circuit_open";
                d.LastError = "circuit_breaker_open";
                continue;
            }

            d.Attempts++;
            // Re-sign with current secret (rotation-safe for in-flight).
            d.TimestampUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            d.SignatureHeader = WebhookSigner.Sign(sub.SigningSecret, d.TimestampUnix, d.PayloadJson);

            var attempt = new WebhookDeliveryAttempt(
                d.DeliveryId,
                sub.TargetUrl,
                d.PayloadJson,
                d.SignatureHeader!,
                d.TimestampUnix,
                new Dictionary<string, string>
                {
                    ["X-NightWatch-Signature"] = d.SignatureHeader!,
                    ["X-NightWatch-Timestamp"] = d.TimestampUnix.ToString(),
                    ["X-NightWatch-Delivery-Id"] = d.DeliveryId,
                    ["Content-Type"] = "application/json"
                });

            WebhookSendResult result;
            try
            {
                result = await transport(attempt);
            }
            catch (Exception ex)
            {
                result = new WebhookSendResult(false, null, ex.Message);
            }

            if (result.Success)
            {
                d.Status = "delivered";
                d.DeliveredAt = DateTimeOffset.UtcNow;
                d.LastError = null;
                _circuits[sub.SubscriptionId] = (0, null);
                n++;
                continue;
            }

            d.LastError = result.Error ?? ("status_" + result.StatusCode);
            var failures = (_circuits.TryGetValue(sub.SubscriptionId, out var c) ? c.Failures : 0) + 1;
            if (failures >= _options.CircuitFailureThreshold)
            {
                _circuits[sub.SubscriptionId] = (failures, DateTimeOffset.UtcNow.Add(_options.CircuitOpenDuration));
                logger.LogWarning("webhook_circuit_open subscription={Sub}", sub.SubscriptionId);
            }
            else
            {
                _circuits[sub.SubscriptionId] = (failures, null);
            }

            if (d.Attempts >= _options.MaxAttempts)
            {
                d.Status = "dead";
            }
            else
            {
                var delay = TimeSpan.FromMilliseconds(
                    _options.InitialBackoff.TotalMilliseconds * Math.Pow(_options.BackoffFactor, d.Attempts - 1));
                d.NextAttemptAt = DateTimeOffset.UtcNow.Add(delay);
                d.Status = "pending";
            }

            n++;
        }

        return n;
    }

    public bool ReplayDead(string deliveryId)
    {
        if (!_deliveries.TryGetValue(deliveryId, out var d) || d.Status is not ("dead" or "circuit_open"))
        {
            return false;
        }

        d.Status = "pending";
        d.NextAttemptAt = DateTimeOffset.UtcNow;
        d.LastError = null;
        return true;
    }

    public IReadOnlyList<WebhookDeliveryRecord> ListDeliveries(string tenantId) =>
        _deliveries.Values.Where(d => d.TenantId == tenantId).OrderBy(d => d.CreatedAt).ToList();

    public WebhookSubscription? GetSubscription(string subscriptionId) =>
        _subs.TryGetValue(subscriptionId, out var s) ? s : null;

    public IReadOnlyList<WebhookSubscription> ListSubscriptions(string tenantId, string? environmentId = null) =>
        _subs.Values
            .Where(s => s.TenantId == tenantId && (environmentId is null || s.EnvironmentId == environmentId))
            .OrderBy(s => s.CreatedAt)
            .ToList();
}
