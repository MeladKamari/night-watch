namespace NightWatch.Modules.Identity.Matching;

public enum EvidenceClass
{
    Browser,
    Device,
    Network,
    Session,
    Cryptographic,
    UserAuthenticated
}

public sealed record SignalTaxonomyEntry(
    string SignalId,
    EvidenceClass Class,
    string Stability,      // high | medium | low | volatile
    string Spoofability,   // hard | medium | easy
    string Uniqueness,     // high | medium | low | shared
    string Availability,   // common | uncommon | rare | unknown
    string Sensitivity,    // low | medium | high
    string Expiry,         // session | days | persistent | unknown
    bool HardIdentityKeyAllowed,
    bool SharedDeviceTrap,
    bool KnownUserBindingOnly,
    string AlgorithmVersion);

public static class EvidenceTaxonomy
{
    public const string Version = "night-watch-taxonomy-v1";

    public static readonly IReadOnlyList<SignalTaxonomyEntry> Entries =
    [
        new("platform", EvidenceClass.Browser, "medium", "easy", "low", "common", "low", "persistent", false, true, false, Version),
        new("timezone", EvidenceClass.Browser, "medium", "easy", "low", "common", "low", "days", false, true, false, Version),
        new("languages", EvidenceClass.Browser, "medium", "easy", "low", "common", "low", "days", false, true, false, Version),
        new("canvas", EvidenceClass.Device, "medium", "medium", "medium", "common", "high", "persistent", false, true, false, Version),
        new("webGlBasics", EvidenceClass.Device, "medium", "medium", "medium", "common", "medium", "persistent", false, true, false, Version),
        new("audio", EvidenceClass.Device, "low", "medium", "medium", "common", "high", "persistent", false, true, false, Version),
        new("fonts", EvidenceClass.Device, "medium", "medium", "medium", "common", "medium", "persistent", false, true, false, Version),
        new("screenResolution", EvidenceClass.Device, "low", "easy", "low", "common", "low", "days", false, true, false, Version),
        new("hardwareConcurrency", EvidenceClass.Device, "high", "medium", "low", "common", "low", "persistent", false, true, false, Version),
        new("deviceMemory", EvidenceClass.Device, "high", "medium", "low", "uncommon", "low", "persistent", false, true, false, Version),
        new("clientIp", EvidenceClass.Network, "volatile", "easy", "low", "common", "medium", "session", false, true, false, Version),
        new("asn", EvidenceClass.Network, "volatile", "easy", "low", "uncommon", "medium", "session", false, true, false, Version),
        new("continuityCookie", EvidenceClass.Session, "medium", "hard", "medium", "uncommon", "medium", "days", true, false, false, Version),
        new("tlsJa3", EvidenceClass.Cryptographic, "medium", "hard", "medium", "rare", "medium", "days", false, false, false, Version),
        new("linkedAccount", EvidenceClass.UserAuthenticated, "high", "hard", "high", "uncommon", "high", "persistent", true, false, true, Version),
        new("colorDepth", EvidenceClass.Browser, "high", "easy", "low", "common", "low", "persistent", false, true, false, Version),
        new("touchSupport", EvidenceClass.Device, "high", "easy", "low", "common", "low", "persistent", false, true, false, Version),
        new("vendor", EvidenceClass.Browser, "medium", "easy", "low", "common", "low", "days", false, true, false, Version),
        new("pdfViewerEnabled", EvidenceClass.Browser, "low", "easy", "low", "common", "low", "days", false, true, false, Version),
        new("reducedMotion", EvidenceClass.Browser, "volatile", "easy", "low", "common", "low", "session", false, true, false, Version),
        new("applePay", EvidenceClass.Browser, "low", "easy", "low", "rare", "low", "session", false, false, false, Version) // excluded product-wide
    ];

    /// <summary>Misleading fingerprint counterexamples — must NOT be hard identity keys alone.</summary>
    public static readonly IReadOnlyList<string> MisleadingCounterexamples =
    [
        "shared_office_workstation_same_canvas",
        "os_upgrade_changes_webgl",
        "browser_update_changes_audio",
        "private_mode_clears_continuity",
        "vpn_changes_ip_asn",
        "timezone_travel",
        "language_pack_install",
        "external_monitor_resolution_change",
        "vm_clone_hardwareConcurrency",
        "headless_spoof_platform",
        "extension_blocks_fonts",
        "incognito_sessionStorage",
        "corporate_proxy_tls_fingerprint",
        "mobile_desktop_mode",
        "remote_desktop_shared_gpu",
        "cookie_cleared_same_device",
        "second_browser_profile",
        "family_shared_tablet",
        "cdn_edge_ip_rotation",
        "accessibility_reducedMotion_toggle",
        "gpu_driver_update"
    ];

    public static SignalTaxonomyEntry? Get(string signalId) =>
        Entries.FirstOrDefault(e => e.SignalId == signalId);

    public static bool IsHardIdentityKey(string signalId) =>
        Get(signalId)?.HardIdentityKeyAllowed == true && signalId != "applePay";
}
