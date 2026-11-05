using System.Collections.Concurrent;

namespace NightWatch.Modules.Risk.SmartSignals;

/// <summary>
/// Three-valued detection outcome. Unknown must never be coerced to not_detected.
/// </summary>
public enum DetectionTriState
{
    Detected,
    NotDetected,
    Unknown
}

public sealed record SignalProvenance(
    string Source,
    DateTimeOffset? InputFreshness,
    string ModelVersion,
    string PlatformAvailability,
    string? Reason);

public sealed record UnifiedSignalOutcome(
    string SignalId,
    string Status, // detected | not_detected | unknown | unsupported | unavailable | not_applicable | error
    DetectionTriState TriState,
    string? Value,
    double? Confidence,
    SignalProvenance Provenance,
    IReadOnlyList<string> Evidence,
    DateTimeOffset ObservedAt,
    string Mode,
    bool FromCache);

public sealed record SignalCatalogEntry(
    string SignalId,
    string Channel, // web_server | native_deferred
    bool Evaluable,
    string? DeferralReason);

/// <summary>
/// Unified registry: 21 evaluable web/server signals + 10 deferred native-only (never evaluated).
/// Adds provenance, three-valued logic, and TTL cache with invalidation.
/// </summary>
public sealed class UnifiedSignalRegistry
{
    public static readonly IReadOnlyList<string> WebServerSignalIds =
    [
        "browser_bot_detection",
        "ai_agent_detection",
        "browser_automation_agent_detection",
        "remote_access_detection",
        "high_activity_device",
        "virtual_machine_detection",
        "developer_tools_detection",
        "raw_device_attributes",
        "browser_tamper_detection",
        "anti_detect_browser_detection",
        "tampered_request_detection",
        "mitm_attack_detection",
        "vpn_detection",
        "proxy_detection",
        "incognito_detection",
        "privacy_focused_browser_detection",
        "ip_geolocation",
        "proximity_detection",
        "velocity_signals",
        "rare_device_detection",
        "ip_blocklist_matching"
    ];

    public static readonly IReadOnlyList<string> NativeDeferredSignalIds =
    [
        "emulator_detection",
        "cloned_app_detection",
        "factory_reset_detection",
        "frida_detection",
        "jailbreak_root_detection",
        "location_spoofing_detection",
        "app_cloners_detection",
        "mitm_native_detection",
        "vpn_native_detection",
        "high_demand_native_device"
    ];

    private readonly SmartSignalRegistry _inner;
    private readonly ConcurrentDictionary<string, (UnifiedSignalOutcome Outcome, DateTimeOffset Expires)> _cache = new(StringComparer.Ordinal);
    private readonly TimeSpan _cacheTtl;

    public UnifiedSignalRegistry(SmartSignalRegistry? inner = null, TimeSpan? cacheTtl = null)
    {
        _inner = inner ?? new SmartSignalRegistry();
        _cacheTtl = cacheTtl ?? TimeSpan.FromSeconds(30);
        EnsureNoCircularDependencies();
    }

    public IReadOnlyList<SignalCatalogEntry> Catalog
    {
        get
        {
            var list = new List<SignalCatalogEntry>(WebServerSignalIds.Count + NativeDeferredSignalIds.Count);
            foreach (var id in WebServerSignalIds)
            {
                list.Add(new SignalCatalogEntry(id, "web_server", Evaluable: true, DeferralReason: null));
            }

            foreach (var id in NativeDeferredSignalIds)
            {
                list.Add(new SignalCatalogEntry(id, "native_deferred", Evaluable: false, DeferralReason: "native_sdk_excluded_iran_webjs_only"));
            }

            return list;
        }
    }

    public void SetMode(string signalId, string mode) => _inner.SetMode(signalId, mode);

    public void Invalidate(string? signalIdOrCacheKey = null)
    {
        if (signalIdOrCacheKey is null)
        {
            _cache.Clear();
            return;
        }

        if (_cache.TryRemove(signalIdOrCacheKey, out _))
        {
            return;
        }

        foreach (var key in _cache.Keys.Where(k => k.StartsWith(signalIdOrCacheKey + "|", StringComparison.Ordinal)).ToList())
        {
            _cache.TryRemove(key, out _);
        }
    }

    public UnifiedSignalOutcome Evaluate(string signalId, SmartSignalInput input, string cacheKeySuffix = "")
    {
        if (NativeDeferredSignalIds.Contains(signalId, StringComparer.Ordinal))
        {
            return DeferredNative(signalId);
        }

        var cacheKey = BuildCacheKey(signalId, input, cacheKeySuffix);
        if (_cache.TryGetValue(cacheKey, out var hit) && hit.Expires > DateTimeOffset.UtcNow)
        {
            return hit.Outcome with { FromCache = true };
        }

        SmartSignalResult raw;
        try
        {
            raw = _inner.Evaluate(signalId, input);
        }
        catch (Exception ex)
        {
            return new UnifiedSignalOutcome(
                signalId,
                "error",
                DetectionTriState.Unknown,
                null,
                null,
                new SignalProvenance("evaluator", null, "error", input.Platform, ex.GetType().Name),
                ["evaluator_exception"],
                DateTimeOffset.UtcNow,
                "enforce",
                FromCache: false);
        }

        var mapped = Map(raw, input);
        _cache[cacheKey] = (mapped, DateTimeOffset.UtcNow.Add(_cacheTtl));
        return mapped;
    }

    public IReadOnlyList<UnifiedSignalOutcome> EvaluateAllWeb(SmartSignalInput input, string cacheKeySuffix = "")
    {
        var results = new List<UnifiedSignalOutcome>(WebServerSignalIds.Count);
        foreach (var id in WebServerSignalIds)
        {
            results.Add(Evaluate(id, input, cacheKeySuffix));
        }

        return results;
    }

    private static string BuildCacheKey(string signalId, SmartSignalInput input, string cacheKeySuffix)
    {
        // Include material input fields so unknown vs known outcomes never collide.
        var artifacts = input.AutomationArtifacts is null ? "" : string.Join(',', input.AutomationArtifacts);
        var brands = input.ClientHintBrands is null ? "" : string.Join(',', input.ClientHintBrands);
        var material =
            $"{input.Platform}|{input.UserAgent}|{input.HeadlessHints}|{input.WebDriver}|{input.AccessibilityTooling}|" +
            $"{input.VerifiedCrawler}|{input.EventsLastHour}|{input.VmHints}|{input.DevtoolsOpen}|" +
            $"{input.TamperHints}|{input.AntiDetectHints}|{input.RequestTamper}|{input.MitmHints}|{input.AsnStatus}|" +
            $"{input.VpnHints}|{input.ProxyHints}|{input.IncognitoHints}|probe={input.ProbeCollected}|artifacts={artifacts}|" +
            $"sig={input.SignatureAgent}|brands={brands}|cdp={input.CdpSideEffect}|chromeMiss={input.ChromeRuntimeMissing}|" +
            $"geo={input.GeoRegion}|bl={input.BlocklistHit}|attrs={(input.DeviceAttrs?.Count ?? 0)}|{cacheKeySuffix}";
        return $"{signalId}|{material}";
    }

    private static UnifiedSignalOutcome DeferredNative(string signalId) =>
        new(
            signalId,
            "unsupported",
            DetectionTriState.Unknown,
            null,
            null,
            new SignalProvenance("catalog", null, "none", "native_unsupported", "native_sdk_excluded"),
            ["never_evaluated"],
            DateTimeOffset.UtcNow,
            "disabled",
            FromCache: false);

    private static UnifiedSignalOutcome Map(SmartSignalResult raw, SmartSignalInput input)
    {
        var (status, tri) = NormalizeStatus(raw.Status, raw.Value);
        var freshness = raw.ObservedAt;
        var provenance = new SignalProvenance(
            Source: "smart_signal_evaluator",
            InputFreshness: freshness,
            ModelVersion: raw.ModelVersion,
            PlatformAvailability: input.Platform,
            Reason: raw.Limitations);

        return new UnifiedSignalOutcome(
            raw.SignalId,
            status,
            tri,
            raw.Value,
            raw.Confidence,
            provenance,
            raw.Evidence,
            raw.ObservedAt,
            raw.Mode,
            FromCache: false);
    }

    /// <summary>
    /// Map legacy statuses/values to honest detection vocabulary without treating unknown as negative.
    /// </summary>
    public static (string Status, DetectionTriState Tri) NormalizeStatus(string status, string? value)
    {
        if (status is "unsupported" or "unavailable" or "not_applicable" or "error")
        {
            return (status, DetectionTriState.Unknown);
        }

        if (status is "unknown")
        {
            return ("unknown", DetectionTriState.Unknown);
        }

        // status == known (or similar): interpret value
        if (value is null)
        {
            return ("unknown", DetectionTriState.Unknown);
        }

        if (IsNegativeValue(value))
        {
            return ("not_detected", DetectionTriState.NotDetected);
        }

        if (IsPositiveDetectionValue(value))
        {
            return ("detected", DetectionTriState.Detected);
        }

        // Informational values (geo present, velocity band, attrs present) stay as known → unknown tri
        // so risk engine does not treat them as abuse detections by default.
        if (IsInformationalValue(value))
        {
            return ("unknown", DetectionTriState.Unknown);
        }

        return ("detected", DetectionTriState.Detected);
    }

    private static bool IsNegativeValue(string value) =>
        value is "not_detected" or "ok" or "closed" or "normal" or "not_listed" or "good_bot";

    private static bool IsPositiveDetectionValue(string value) =>
        value is "bad_bot" or "suspected_ai_agent" or "automation_agent_suspected" or "remote_access_suspected"
            or "high" or "vm_suspected" or "open"
            or "tamper_suspected" or "suspected" or "tampered" or "vpn_suspected" or "proxy_suspected"
            or "privacy_oriented_suspected" or "extreme" or "elevated" or "listed" or "rare_suspected"
            or "impossible_travel_suspected" or "location_jump_suspected";

    private static bool IsInformationalValue(string value) =>
        value is "present" or "coarse_region_available" or "insufficient_population_stats";

    private void EnsureNoCircularDependencies()
    {
        // Evaluators are leaf functions over SmartSignalInput; registry does not call other signals.
        // Explicit invariant: catalog IDs are unique across web and deferred.
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in WebServerSignalIds.Concat(NativeDeferredSignalIds))
        {
            if (!seen.Add(id))
            {
                throw new InvalidOperationException($"Duplicate signal id in catalog: {id}");
            }
        }

        if (_inner.RegisteredIds.Count < WebServerSignalIds.Count)
        {
            throw new InvalidOperationException("Inner SmartSignalRegistry missing evaluators for web catalog.");
        }
    }
}
