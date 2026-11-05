using System.Collections.Concurrent;
using NightWatch.BuildingBlocks;

namespace NightWatch.Modules.Risk.SmartSignals;

public sealed record SmartSignalResult(
    string SignalId,
    string Status, // known | unknown | unsupported | unavailable | not_applicable
    string? Value,
    double? Confidence,
    IReadOnlyList<string> Evidence,
    DateTimeOffset ObservedAt,
    string ModelVersion,
    string? Limitations,
    string Mode); // enforce | shadow | disabled

public sealed record SmartSignalInput(
    string? UserAgent,
    bool? HeadlessHints,
    bool? WebDriver,
    bool? AccessibilityTooling,
    bool? VerifiedCrawler,
    bool? AiAgentHints,
    int? EventsLastHour,
    bool? VmHints,
    bool? DevtoolsOpen,
    IReadOnlyDictionary<string, string?>? DeviceAttrs,
    bool? TamperHints,
    bool? AntiDetectHints,
    bool? RequestTamper,
    bool? MitmHints,
    string? AsnStatus, // known | unknown | unavailable | stale
    bool? VpnHints,
    bool? ProxyHints,
    bool? IncognitoHints,
    string Platform, // browser | server | native_unsupported
    bool? BrowserAutomationHints = null,
    bool? RemoteAccessHints = null,
    /// <summary>Artifacts actually observed in the browser (e.g. navigator.webdriver, window.__playwright). Never invent.</summary>
    IReadOnlyList<string>? AutomationArtifacts = null,
    /// <summary>True when a client environment probe ran (even if nothing suspicious found).</summary>
    bool ProbeCollected = false,
    /// <summary>HTTP Signature-Agent (ChatGPT agent / signed bot auth), when present on the request.</summary>
    string? SignatureAgent = null,
    /// <summary>UA-CH brands observed by the client probe.</summary>
    IReadOnlyList<string>? ClientHintBrands = null,
    bool? CdpSideEffect = null,
    bool? ChromeRuntimeMissing = null,
    /// <summary>Coarse offline geo label (e.g. ir-tehran) from signed feeds.</summary>
    string? GeoRegion = null,
    /// <summary>True when IP matched offline abuse blocklist.</summary>
    bool? BlocklistHit = null,
    /// <summary>0..1 local population rarity from tenant baseline (null = insufficient samples).</summary>
    double? PopulationRarity = null,
    /// <summary>User granted proximity/location comparison consent.</summary>
    bool? ProximityConsent = null,
    /// <summary>Prior coarse location label (consented).</summary>
    string? PriorLocationLabel = null,
    /// <summary>Current coarse location label (consented).</summary>
    string? CurrentLocationLabel = null,
    /// <summary>Optional distance km between consented locations.</summary>
    double? LocationDistanceKm = null);

public interface ISmartSignalEvaluator
{
    string SignalId { get; }
    SmartSignalResult Evaluate(SmartSignalInput input, string mode);
}

public abstract class SmartSignalEvaluatorBase(string signalId, string modelVersion) : ISmartSignalEvaluator
{
    public string SignalId { get; } = signalId;
    protected string ModelVersion { get; } = modelVersion;

    public SmartSignalResult Evaluate(SmartSignalInput input, string mode)
    {
        if (mode == "disabled")
        {
            return Result("not_applicable", null, null, ["disabled_by_tenant"], "tenant_disabled");
        }

        if (input.Platform is "native_unsupported")
        {
            return Result("unsupported", null, null, ["native_sdk_excluded"], "browser_server_only");
        }

        return EvaluateCore(input, mode);
    }

    protected abstract SmartSignalResult EvaluateCore(SmartSignalInput input, string mode);

    protected SmartSignalResult Result(string status, string? value, double? conf, IReadOnlyList<string> evidence, string? limitations) =>
        new(SignalId, status, value, conf, evidence, DateTimeOffset.UtcNow, ModelVersion, limitations, "enforce");
}

public sealed class BrowserBotDetectionEvaluator() : SmartSignalEvaluatorBase("browser_bot_detection", "bot-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.VerifiedCrawler == true)
        {
            return Result("known", "good_bot", 0.9, ["verified_crawler_proof"], "verified_crawler_precedence");
        }

        if (input.AccessibilityTooling == true && input.WebDriver != true)
        {
            return Result("known", "not_detected", 0.4, ["accessibility_tooling_alone_not_abuse"], "a11y_not_fail_closed");
        }

        if (input.UserAgent is null && input.WebDriver is null && input.HeadlessHints is null)
        {
            return Result("unknown", null, null, ["missing_inputs"], "no_false_negative");
        }

        var evidence = new List<string>();
        var score = 0;
        if (input.WebDriver == true) { score += 2; evidence.Add("webdriver"); }
        if (input.HeadlessHints == true) { score += 2; evidence.Add("headless"); }
        if (input.UserAgent?.Contains("HeadlessChrome", StringComparison.OrdinalIgnoreCase) == true)
        {
            score += 2; evidence.Add("ua_headless");
        }

        if (score >= 3) return Result("known", "bad_bot", 0.7, evidence, "not_sole_fail_closed");
        if (score == 0) return Result("known", "not_detected", 0.5, ["ordinary_browser"], null);
        return Result("known", "unknown", 0.3, evidence, "weak_signals_only");
    }
}

/// <summary>
/// AI / agentic browser agents — precise observed markers only.
/// Generic Playwright/headless alone is automation, NOT AI.
/// </summary>
public sealed class AiAgentDetectionEvaluator() : SmartSignalEvaluatorBase("ai_agent_detection", "ai-agent-v3")
{
    internal static readonly string[] AgenticUaMarkers =
    [
        "openai-operator", "chatgpt-user", "chatgpt/", "browseruse", "browserbase",
        "anthropic", "claude-web", "computer-use", "agentic", "perplexity", "operator/"
    ];

    private static readonly string[] SignatureAgentHosts =
    [
        "chatgpt.com", "openai.com", "browseruse.com", "browserbase.com", "anthropic.com"
    ];

    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        var evidence = new List<string>();
        var score = 0;

        // Tier A — signed agent identity (ChatGPT agent web-bot-auth).
        var sig = input.SignatureAgent?.Trim().Trim('"').ToLowerInvariant() ?? "";
        if (sig.Length > 0)
        {
            evidence.Add("header:signature-agent=" + sig);
            if (SignatureAgentHosts.Any(h => sig.Contains(h, StringComparison.Ordinal)))
            {
                score += 50;
                evidence.Add("signed_ai_agent_host");
            }
        }

        // Tier A — explicit agentic UA / UA-CH brands.
        var ua = input.UserAgent?.ToLowerInvariant() ?? "";
        foreach (var m in AgenticUaMarkers)
        {
            if (ua.Contains(m, StringComparison.Ordinal))
            {
                score += 35;
                evidence.Add("ua:" + m);
            }
        }

        foreach (var brand in input.ClientHintBrands ?? [])
        {
            var b = brand.ToLowerInvariant();
            foreach (var m in AgenticUaMarkers)
            {
                if (b.Contains(m, StringComparison.Ordinal))
                {
                    score += 25;
                    evidence.Add("ch-ua:" + brand);
                }
            }
        }

        // Supporting runtime (raises confidence only when agentic identity already present).
        var support = 0;
        void Support(string key, bool hit, int pts)
        {
            if (!hit) return;
            support += pts;
            evidence.Add(key);
        }

        Support("navigator.webdriver", input.WebDriver == true, 8);
        Support("headless_observed", input.HeadlessHints == true, 6);
        Support("cdp.side_effect", input.CdpSideEffect == true, 10);
        Support("chrome.runtime_missing", input.ChromeRuntimeMissing == true, 6);

        foreach (var a in input.AutomationArtifacts ?? [])
        {
            var lower = a.ToLowerInvariant();
            if (lower.StartsWith("ua:", StringComparison.Ordinal))
            {
                // already counted via UA scan when possible; keep as evidence if agentic
                var marker = lower["ua:".Length..];
                if (AgenticUaMarkers.Any(m => marker.Contains(m, StringComparison.Ordinal)))
                {
                    evidence.Add("artifact:" + a);
                }
                continue;
            }

            if (IsAiFrameworkArtifact(lower))
            {
                score += 30;
                evidence.Add("artifact:" + a);
            }
            else if (IsAutomationSupportArtifact(lower))
            {
                Support("artifact:" + a, true, 5);
            }
        }

        var hasAgenticIdentity = score >= 30;
        if (hasAgenticIdentity)
        {
            score += Math.Min(20, support);
            var conf = Math.Clamp(0.45 + score / 200.0, 0.45, 0.92);
            return Result("known", "suspected_ai_agent", conf, evidence.Distinct().ToList(), "observed_markers_precise_v3_not_ml");
        }

        if (!input.ProbeCollected && input.UserAgent is null && string.IsNullOrWhiteSpace(input.SignatureAgent)
            && (input.AutomationArtifacts is null || input.AutomationArtifacts.Count == 0)
            && input.WebDriver is null && input.HeadlessHints is null)
        {
            return Result("unknown", null, null, ["no_environment_probe"], "no_false_negative");
        }

        // Generic automation support without agentic identity → not AI.
        if (support > 0)
        {
            return Result(
                "known",
                "not_detected",
                0.55,
                evidence.Count == 0 ? ["automation_without_agentic_identity"] : evidence.Distinct().ToList(),
                "automation_is_not_ai_agent");
        }

        return Result("known", "not_detected", 0.5, ["no_agentic_markers_observed"], "heuristic_not_ml");
    }

    private static bool IsAiFrameworkArtifact(string lower) =>
        lower.Contains("browseruse", StringComparison.Ordinal)
        || lower.Contains("openai-operator", StringComparison.Ordinal)
        || lower.Contains("chatgpt", StringComparison.Ordinal)
        || lower.Contains("computer-use", StringComparison.Ordinal)
        || lower.Contains("operator", StringComparison.Ordinal);

    private static bool IsAutomationSupportArtifact(string lower) =>
        lower.Contains("playwright", StringComparison.Ordinal)
        || lower.Contains("puppeteer", StringComparison.Ordinal)
        || lower.Contains("selenium", StringComparison.Ordinal)
        || lower.Contains("webdriver", StringComparison.Ordinal)
        || lower.Contains("cdp.", StringComparison.Ordinal)
        || lower.Contains("headless", StringComparison.Ordinal)
        || lower.Contains("chrome.runtime_missing", StringComparison.Ordinal);
}

/// <summary>
/// Browser automation runtimes — observed artifacts / webdriver / UA only. Lab toggles ignored.
/// </summary>
public sealed class BrowserAutomationAgentEvaluator() : SmartSignalEvaluatorBase("browser_automation_agent_detection", "browser-automation-v3")
{
    private static readonly string[] UaMarkers =
    [
        "browseruse", "browserbase", "playwright", "puppeteer", "selenium",
        "openai-operator", "agentic", "headlesschrome", "chromium-headless-shell"
    ];

    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        var evidence = new List<string>();
        var ua = input.UserAgent?.ToLowerInvariant() ?? "";
        foreach (var m in UaMarkers)
        {
            if (ua.Contains(m, StringComparison.Ordinal))
            {
                evidence.Add("ua:" + m);
            }
        }

        foreach (var brand in input.ClientHintBrands ?? [])
        {
            if (brand.Contains("Headless", StringComparison.OrdinalIgnoreCase))
            {
                evidence.Add("ch-ua:" + brand);
            }
        }

        foreach (var a in input.AutomationArtifacts ?? [])
        {
            if (!string.IsNullOrWhiteSpace(a))
            {
                evidence.Add("artifact:" + a);
            }
        }

        if (input.WebDriver == true) evidence.Add("navigator.webdriver");
        if (input.HeadlessHints == true) evidence.Add("headless_observed");
        if (input.CdpSideEffect == true) evidence.Add("cdp.side_effect");
        if (input.ChromeRuntimeMissing == true) evidence.Add("chrome.runtime_missing");

        if (evidence.Count > 0)
        {
            var strong = evidence.Exists(e =>
                e.StartsWith("artifact:", StringComparison.Ordinal)
                || e is "navigator.webdriver" or "cdp.side_effect");
            return Result("known", "automation_agent_suspected", strong ? 0.7 : 0.4, evidence.Distinct().ToList(), "observed_only_not_simulated");
        }

        if (!input.ProbeCollected && input.UserAgent is null)
        {
            return Result("unsupported", null, null, ["no_automation_probe"], "awaiting_client_probe");
        }

        return Result("known", "not_detected", 0.45, ["no_automation_markers_observed"], null);
    }
}

/// <summary>
/// Remote desktop markers — UA / artifacts only. Lab toggles ignored.
/// </summary>
public sealed class RemoteAccessDetectionEvaluator() : SmartSignalEvaluatorBase("remote_access_detection", "remote-access-v2")
{
    private static readonly string[] UaMarkers = ["teamviewer", "anydesk", "chrome-remote", "vnc", "rdp"];

    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        var evidence = new List<string>();
        var ua = input.UserAgent?.ToLowerInvariant() ?? "";
        foreach (var m in UaMarkers)
        {
            if (ua.Contains(m, StringComparison.Ordinal))
            {
                evidence.Add("ua:" + m);
            }
        }

        foreach (var a in input.AutomationArtifacts ?? [])
        {
            var lower = a.ToLowerInvariant();
            if (UaMarkers.Any(m => lower.Contains(m, StringComparison.Ordinal))
                || lower.Contains("remote", StringComparison.Ordinal))
            {
                evidence.Add("artifact:" + a);
            }
        }

        if (evidence.Count > 0)
        {
            return Result("known", "remote_access_suspected", 0.4, evidence, "observed_only_not_simulated");
        }

        if (!input.ProbeCollected && input.UserAgent is null)
        {
            return Result("unsupported", null, null, ["no_remote_access_probe"], "awaiting_client_probe");
        }

        return Result("known", "not_detected", 0.35, ["no_remote_access_markers_observed"], null);
    }
}

public sealed class HighActivityDeviceEvaluator() : SmartSignalEvaluatorBase("high_activity_device", "activity-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.EventsLastHour is null) return Result("unavailable", null, null, ["counter_unavailable"], null);
        return input.EventsLastHour > 100
            ? Result("known", "high", 0.6, [$"events={input.EventsLastHour}"], "velocity_only")
            : Result("known", "normal", 0.5, [$"events={input.EventsLastHour}"], null);
    }
}

public sealed class VmDetectionEvaluator() : SmartSignalEvaluatorBase("virtual_machine_detection", "vm-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode) =>
        input.VmHints is null
            ? Result("unavailable", null, null, ["vm_signals_unavailable"], "conditional_feed")
            : Result("known", input.VmHints == true ? "vm_suspected" : "not_detected", 0.4, ["vm_hints"], "not_authoritative");
}

public sealed class DevtoolsDetectionEvaluator() : SmartSignalEvaluatorBase("developer_tools_detection", "devtools-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode) =>
        input.DevtoolsOpen is null
            ? Result("unknown", null, null, ["no_devtools_probe"], null)
            : Result("known", input.DevtoolsOpen == true ? "open" : "closed", 0.3, ["devtools_probe"], "easy_to_spoof");
}

public sealed class RawDeviceAttributesEvaluator() : SmartSignalEvaluatorBase("raw_device_attributes", "raw-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.DeviceAttrs is null || input.DeviceAttrs.Count == 0)
        {
            return Result("unknown", null, null, ["no_attrs"], null);
        }

        var keys = string.Join(",", input.DeviceAttrs.Keys.OrderBy(k => k));
        return Result("known", "present", 0.5, [$"keys={keys}"], "values_redacted_in_logs");
    }
}

public sealed class BrowserTamperEvaluator() : SmartSignalEvaluatorBase("browser_tamper_detection", "tamper-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode) =>
        input.TamperHints is null
            ? Result("unknown", null, null, ["no_tamper_probe"], null)
            : Result("known", input.TamperHints == true ? "tamper_suspected" : "not_detected", 0.4, ["tamper_hints"], null);
}

public sealed class AntiDetectBrowserEvaluator() : SmartSignalEvaluatorBase("anti_detect_browser_detection", "antidetect-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.AntiDetectHints is not null)
        {
            return Result("known", input.AntiDetectHints == true ? "suspected" : "not_detected", 0.3, ["antidetect_hints"], "high_fp_risk");
        }

        if (!input.ProbeCollected && input.UserAgent is null)
        {
            return Result("unavailable", null, null, ["conditional_unavailable"], null);
        }

        var brands = input.ClientHintBrands ?? [];
        var weirdBrand = brands.Any(b => b.Contains("Not_A Brand", StringComparison.OrdinalIgnoreCase)
                                         || b.Contains("Not A;Brand", StringComparison.OrdinalIgnoreCase));
        var suspected = weirdBrand && input.ChromeRuntimeMissing == true;
        return Result(
            "known",
            suspected ? "suspected" : "not_detected",
            0.25,
            suspected ? ["ua_ch_weird_brand", "chrome_runtime_missing"] : ["no_antidetect_markers"],
            "high_fp_risk");
    }
}

public sealed class TamperedRequestEvaluator() : SmartSignalEvaluatorBase("tampered_request_detection", "req-tamper-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode) =>
        input.RequestTamper is null
            ? Result("unknown", null, null, ["no_integrity_check"], null)
            : Result("known", input.RequestTamper == true ? "tampered" : "ok", 0.7, ["request_integrity"], null);
}

public sealed class MitmDetectionEvaluator() : SmartSignalEvaluatorBase("mitm_attack_detection", "mitm-v2")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.MitmHints is not null)
        {
            return Result("known", input.MitmHints == true ? "suspected" : "not_detected", 0.4, ["mitm_hints"], null);
        }

        // Without edge TLS signals, stay unknown (not unavailable) so score does not pretend feed exists.
        return Result("unknown", null, null, ["no_edge_tls_mitm_signal"], "awaiting_gateway_headers");
    }
}

public sealed class VpnDetectionEvaluator() : SmartSignalEvaluatorBase("vpn_detection", "vpn-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.AsnStatus is "stale" or "unavailable" or "unknown")
        {
            return Result("unavailable", null, null, [$"asn_{input.AsnStatus}"], "safe_default_not_deny");
        }

        return input.VpnHints == true
            ? Result("known", "vpn_suspected", 0.5, ["vpn_hints"], "licensed_feed_optional")
            : Result("known", "not_detected", 0.4, ["asn_known"], null);
    }
}

public sealed class ProxyDetectionEvaluator() : SmartSignalEvaluatorBase("proxy_detection", "proxy-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.ProxyHints is null)
        {
            return input.AsnStatus is "known"
                ? Result("known", "not_detected", 0.35, ["asn_known_no_proxy_hint"], null)
                : Result("unavailable", null, null, ["proxy_feed_unavailable"], "conditional");
        }

        return Result("known", input.ProxyHints == true ? "proxy_suspected" : "not_detected", 0.4, ["proxy_hints"], null);
    }
}

public sealed class IncognitoDetectionEvaluator() : SmartSignalEvaluatorBase("incognito_detection", "incognito-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode) =>
        input.IncognitoHints is null
            ? Result("unknown", null, null, ["no_incognito_probe"], "unreliable_across_browsers")
            : Result("known", input.IncognitoHints == true ? "suspected" : "not_detected", 0.2, ["incognito_hints"], "high_uncertainty");
}

public sealed class PrivacyFocusedBrowserEvaluator() : SmartSignalEvaluatorBase("privacy_focused_browser_detection", "privacy-browser-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        var ua = input.UserAgent ?? "";
        if (string.IsNullOrWhiteSpace(ua)) return Result("unknown", null, null, ["missing_ua"], null);
        if (ua.Contains("Firefox", StringComparison.OrdinalIgnoreCase) && ua.Contains("rv:", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("Brave", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("Tor", StringComparison.OrdinalIgnoreCase))
        {
            return Result("known", "privacy_oriented_suspected", 0.4, ["ua_privacy_hints"], "not_abuse_alone");
        }

        return Result("known", "not_detected", 0.3, ["ordinary_ua"], null);
    }
}

public sealed class IpGeolocationEvaluator() : SmartSignalEvaluatorBase("ip_geolocation", "geo-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (!string.IsNullOrWhiteSpace(input.GeoRegion))
        {
            return Result("known", "coarse_region_available", 0.55, [$"geo={input.GeoRegion}"], "coarse_offline_only");
        }

        if (input.AsnStatus is "stale" or "unavailable" or "unknown" or null)
        {
            return Result("unavailable", null, null, ["geo_feed_unavailable"], "no_foreign_saas_runtime");
        }

        // ASN known (e.g. IR operator) without city-level geo — still coarse-available at country/operator level.
        return Result("known", "coarse_region_available", 0.4, ["asn_known_no_city_geo"], "coarse_only");
    }
}

public sealed class ProximityDetectionEvaluator() : SmartSignalEvaluatorBase("proximity_detection", "proximity-v2")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.ProximityConsent != true)
        {
            return Result("unavailable", null, null, ["proximity_requires_consent"], "consent_gated");
        }

        if (string.IsNullOrWhiteSpace(input.PriorLocationLabel)
            || string.IsNullOrWhiteSpace(input.CurrentLocationLabel))
        {
            return Result("unavailable", null, null, ["proximity_requires_labeled_locations"], "consent_ok_labels_missing");
        }

        if (input.LocationDistanceKm is >= 800)
        {
            return Result("known", "impossible_travel_suspected", 0.55,
                [$"distance_km={input.LocationDistanceKm:0}"], "consented_coarse_only");
        }

        if (!string.Equals(input.PriorLocationLabel, input.CurrentLocationLabel, StringComparison.OrdinalIgnoreCase))
        {
            return Result("known", "location_jump_suspected", 0.4,
                [$"from={input.PriorLocationLabel}", $"to={input.CurrentLocationLabel}"], "consented_coarse_only");
        }

        return Result("known", "not_detected", 0.45,
            [$"stable_location={input.CurrentLocationLabel}"], "consented_coarse_only");
    }
}

public sealed class VelocitySignalsEvaluator() : SmartSignalEvaluatorBase("velocity_signals", "velocity-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.EventsLastHour is null) return Result("unavailable", null, null, ["velocity_counter_unavailable"], null);
        var v = input.EventsLastHour.Value;
        var band = v switch { > 200 => "extreme", > 50 => "elevated", _ => "normal" };
        return Result("known", band, 0.6, [$"events_last_hour={v}"], null);
    }
}

public sealed class RareDeviceDetectionEvaluator() : SmartSignalEvaluatorBase("rare_device_detection", "rare-v2")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.DeviceAttrs is null || input.DeviceAttrs.Count == 0)
        {
            return Result("unavailable", null, null, ["needs_population_stats"], "conditional");
        }

        if (input.PopulationRarity is double rarity)
        {
            return rarity >= 0.9
                ? Result("known", "rare_suspected", 0.55, [$"local_rarity={rarity:0.###}"], "tenant_local_baseline")
                : Result("known", "not_detected", 0.45, [$"local_rarity={rarity:0.###}"], "tenant_local_baseline");
        }

        // Fallback attr oddities when population still warming up.
        var odd = 0;
        if (input.DeviceAttrs.TryGetValue("deviceMemory", out var mem) && mem is "0.25" or "0.5") odd++;
        if (input.DeviceAttrs.TryGetValue("hardwareConcurrency", out var hc) && hc is "1") odd++;
        if (input.DeviceAttrs.TryGetValue("maxTouchPoints", out var tp) && tp is "0"
            && input.DeviceAttrs.TryGetValue("platform", out var plat)
            && plat is not null && plat.Contains("Android", StringComparison.OrdinalIgnoreCase))
        {
            odd++;
        }

        return odd >= 2
            ? Result("known", "rare_suspected", 0.35, [$"odd_attrs={odd}"], "local_heuristic_warming")
            : Result("known", "insufficient_population_stats", 0.25, ["attrs_present_local_baseline_warming"], "tenant_local_baseline");
    }
}

public sealed class IpBlocklistMatchingEvaluator() : SmartSignalEvaluatorBase("ip_blocklist_matching", "blocklist-v1")
{
    protected override SmartSignalResult EvaluateCore(SmartSignalInput input, string mode)
    {
        if (input.BlocklistHit == true)
        {
            return Result("known", "listed", 0.7, ["offline_abuse_hit"], "admin_provisioned_lists_only");
        }

        if (input.BlocklistHit == false || input.AsnStatus == "known")
        {
            return Result("known", "not_listed", 0.5, ["local_blocklist_miss"], "admin_provisioned_lists_only");
        }

        if (input.AsnStatus is "stale" or "unavailable" or null)
        {
            return Result("unavailable", null, null, ["blocklist_unavailable"], "fail_open_signal_only");
        }

        return Result("known", "not_listed", 0.45, ["asn_known_no_abuse_hit"], "admin_provisioned_lists_only");
    }
}

public sealed class SmartSignalRegistry
{
    private readonly ConcurrentDictionary<string, (ISmartSignalEvaluator Eval, string Mode)> _map = new(StringComparer.Ordinal);

    public SmartSignalRegistry()
    {
        foreach (ISmartSignalEvaluator e in new ISmartSignalEvaluator[]
                 {
                     new BrowserBotDetectionEvaluator(),
                     new AiAgentDetectionEvaluator(),
                     new BrowserAutomationAgentEvaluator(),
                     new RemoteAccessDetectionEvaluator(),
                     new HighActivityDeviceEvaluator(),
                     new VmDetectionEvaluator(),
                     new DevtoolsDetectionEvaluator(),
                     new RawDeviceAttributesEvaluator(),
                     new BrowserTamperEvaluator(),
                     new AntiDetectBrowserEvaluator(),
                     new TamperedRequestEvaluator(),
                     new MitmDetectionEvaluator(),
                     new VpnDetectionEvaluator(),
                     new ProxyDetectionEvaluator(),
                     new IncognitoDetectionEvaluator(),
                     new PrivacyFocusedBrowserEvaluator(),
                     new IpGeolocationEvaluator(),
                     new ProximityDetectionEvaluator(),
                     new VelocitySignalsEvaluator(),
                     new RareDeviceDetectionEvaluator(),
                     new IpBlocklistMatchingEvaluator()
                 })
        {
            _map[e.SignalId] = (e, "enforce");
        }
    }

    public void SetMode(string signalId, string mode)
    {
        if (_map.TryGetValue(signalId, out var cur))
        {
            _map[signalId] = (cur.Eval, mode);
        }
    }

    public SmartSignalResult Evaluate(string signalId, SmartSignalInput input)
    {
        if (!_map.TryGetValue(signalId, out var cur))
        {
            return new SmartSignalResult(signalId, "unsupported", null, null, ["unknown_signal"], DateTimeOffset.UtcNow, "none", null, "disabled");
        }

        var result = cur.Eval.Evaluate(input, cur.Mode);
        return result with { Mode = cur.Mode };
    }

    public IReadOnlyList<string> RegisteredIds => _map.Keys.OrderBy(x => x).ToList();
}
