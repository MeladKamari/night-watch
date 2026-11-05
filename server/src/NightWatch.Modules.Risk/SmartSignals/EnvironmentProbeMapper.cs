using System.Text.Json;

namespace NightWatch.Modules.Risk.SmartSignals;

/// <summary>
/// Maps client <c>environmentProbes</c> JSON (+ optional Signature-Agent) to <see cref="SmartSignalInput"/>.
/// Lab boolean toggles (aiAgentHints, etc.) are intentionally ignored.
/// </summary>
public static class EnvironmentProbeMapper
{
    public static SmartSignalInput FromJson(
        JsonElement root,
        string? signatureAgent = null,
        string platform = "browser")
    {
        var probes = root.TryGetProperty("environmentProbes", out var p) && p.ValueKind == JsonValueKind.Object
            ? p
            : root;

        var ua = ReadString(probes, "userAgent") ?? ReadString(root, "userAgent");
        var webDriver = ReadBool(probes, "navigatorWebdriver") ?? ReadBool(probes, "webDriver");
        var headless = ReadBool(probes, "headlessUa")
            ?? ReadBool(probes, "headlessClientHint")
            ?? DeriveHeadlessFromUa(ua);
        var artifacts = ReadStringArray(probes, "automationArtifacts");
        var brands = ReadStringArray(probes, "clientHintBrands");
        var cdp = ReadBool(probes, "cdpSideEffect");
        var chromeMissing = ReadBool(probes, "chromeRuntimeMissing");
        var probeCollected = ReadBool(probes, "probeCollected") == true
            || artifacts.Count > 0
            || webDriver is not null
            || !string.IsNullOrWhiteSpace(ua)
            || brands.Count > 0;

        int? events = null;
        if (probes.TryGetProperty("eventsLastHour", out var ev) && ev.TryGetInt32(out var n))
        {
            events = n;
        }
        else if (root.TryGetProperty("eventsLastHour", out var evRoot) && evRoot.TryGetInt32(out var nr))
        {
            events = nr;
        }

        var asn = ReadString(probes, "asnStatus") ?? ReadString(root, "asnStatus");
        var webgl = ReadString(probes, "webGlRenderer") ?? ReadString(probes, "webglRenderer");
        var incognito = ReadBool(probes, "incognitoSuspected") ?? ReadBool(probes, "incognitoHints");
        var vm = ReadBool(probes, "vmSuspected") ?? DeriveVm(webgl, ReadString(probes, "webGlVendor"));
        var devtools = ReadBool(probes, "devtoolsOpen");
        var deviceAttrs = ReadDeviceAttrs(probes, root);
        bool? tamper = webDriver == true || cdp == true || artifacts.Count > 0
            ? true
            : probeCollected ? false : null;
        bool? antiDetect = DeriveAntiDetect(brands, chromeMissing, probeCollected);
        incognito ??= DeriveIncognitoFromQuota(probes);
        var mitm = ReadBool(probes, "mitmSuspected") ?? ReadBool(root, "mitmSuspected");
        var proximityConsent = ReadBool(probes, "proximityConsent") ?? ReadBool(root, "proximityConsent");
        var priorLoc = ReadString(probes, "priorLocationLabel") ?? ReadString(root, "priorLocationLabel");
        var currLoc = ReadString(probes, "currentLocationLabel") ?? ReadString(root, "currentLocationLabel");
        double? distanceKm = null;
        if (probes.TryGetProperty("locationDistanceKm", out var dkm) && dkm.TryGetDouble(out var dk))
        {
            distanceKm = dk;
        }
        else if (root.TryGetProperty("locationDistanceKm", out var dkmRoot) && dkmRoot.TryGetDouble(out var dkr))
        {
            distanceKm = dkr;
        }

        return new SmartSignalInput(
            UserAgent: ua,
            HeadlessHints: headless,
            WebDriver: webDriver,
            AccessibilityTooling: null,
            VerifiedCrawler: null,
            AiAgentHints: null,
            EventsLastHour: events,
            VmHints: vm,
            DevtoolsOpen: devtools,
            DeviceAttrs: deviceAttrs,
            TamperHints: tamper,
            AntiDetectHints: antiDetect,
            RequestTamper: null,
            MitmHints: mitm,
            AsnStatus: asn,
            VpnHints: null,
            ProxyHints: null,
            IncognitoHints: incognito,
            Platform: platform,
            BrowserAutomationHints: null,
            RemoteAccessHints: null,
            AutomationArtifacts: artifacts,
            ProbeCollected: probeCollected,
            SignatureAgent: string.IsNullOrWhiteSpace(signatureAgent) ? null : signatureAgent,
            ClientHintBrands: brands,
            CdpSideEffect: cdp,
            ChromeRuntimeMissing: chromeMissing,
            ProximityConsent: proximityConsent,
            PriorLocationLabel: priorLoc,
            CurrentLocationLabel: currLoc,
            LocationDistanceKm: distanceKm);
    }

    private static bool? DeriveIncognitoFromQuota(JsonElement probes)
    {
        if (probes.ValueKind != JsonValueKind.Object) return null;
        long? quota = null;
        if (probes.TryGetProperty("storageQuotaBytes", out var q) && q.TryGetInt64(out var qb))
        {
            quota = qb;
        }
        else if (probes.TryGetProperty("storageQuotaMb", out var qm) && qm.TryGetDouble(out var qmd))
        {
            quota = (long)(qmd * 1024 * 1024);
        }

        if (quota is null) return null;
        return quota < 120L * 1024 * 1024;
    }

    private static bool? DeriveVm(string? renderer, string? vendor)
    {
        var blob = $"{renderer}|{vendor}".ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(blob) || blob == "|") return null;
        if (blob.Contains("swiftshader") || blob.Contains("llvmpipe") || blob.Contains("virtualbox")
            || blob.Contains("vmware") || blob.Contains("qemu") || blob.Contains("hyper-v")
            || blob.Contains("parallels"))
        {
            return true;
        }

        return false;
    }

    private static bool? DeriveAntiDetect(IReadOnlyList<string> brands, bool? chromeMissing, bool probeCollected)
    {
        if (!probeCollected && brands.Count == 0) return null;
        var weird = brands.Any(b =>
            b.Contains("Not_A Brand", StringComparison.OrdinalIgnoreCase)
            || b.Contains("Not A;Brand", StringComparison.OrdinalIgnoreCase));
        if (weird && chromeMissing == true) return true;
        return false;
    }

    private static IReadOnlyDictionary<string, string?>? ReadDeviceAttrs(JsonElement probes, JsonElement root)
    {
        var map = new Dictionary<string, string?>(StringComparer.Ordinal);
        void Put(string key, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value)) map[key] = value;
        }

        Put("platform", ReadString(probes, "platform") ?? ReadString(root, "platform"));
        Put("deviceMemory", ReadNumberAsString(probes, "deviceMemory") ?? ReadNumberAsString(root, "deviceMemory"));
        Put("hardwareConcurrency", ReadNumberAsString(probes, "hardwareConcurrency") ?? ReadNumberAsString(root, "hardwareConcurrency"));
        Put("maxTouchPoints", ReadNumberAsString(probes, "maxTouchPoints") ?? ReadNumberAsString(root, "maxTouchPoints"));
        Put("webGlVendor", ReadString(probes, "webGlVendor") ?? ReadString(probes, "webglVendor"));
        Put("webGlRenderer", ReadString(probes, "webGlRenderer") ?? ReadString(probes, "webglRenderer"));
        Put("colorDepth", ReadNumberAsString(probes, "colorDepth"));
        Put("pluginCount", ReadNumberAsString(probes, "pluginCount"));

        if (probes.TryGetProperty("deviceAttrs", out var attrs) && attrs.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in attrs.EnumerateObject())
            {
                map[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => null
                };
            }
        }

        return map.Count == 0 ? null : map;
    }

    private static bool? DeriveHeadlessFromUa(string? ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return null;
        return ua.Contains("HeadlessChrome", StringComparison.OrdinalIgnoreCase)
               || ua.Contains("chromium-headless-shell", StringComparison.OrdinalIgnoreCase)
            ? true
            : null;
    }

    private static string? ReadString(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object
        && el.TryGetProperty(name, out var v)
        && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static string? ReadNumberAsString(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.ToString(),
            JsonValueKind.String => v.GetString(),
            _ => null
        };
    }

    private static bool? ReadBool(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var v))
        {
            return null;
        }

        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }

    private static IReadOnlyList<string> ReadStringArray(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var list = new List<string>();
        foreach (var item in arr.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var s = item.GetString();
                if (!string.IsNullOrWhiteSpace(s))
                {
                    list.Add(s);
                }
            }
        }

        return list;
    }
}
