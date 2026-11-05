namespace NightWatch.BuildingBlocks;

/// <summary>
/// Honest multi-state evidence. Never serialize unknown as false.
/// </summary>
public enum EvidenceStatus
{
    Known,
    Unknown,
    Unsupported,
    Unavailable,
    NotApplicable,
    InsufficientEvidence,
    ProviderUnavailable,
    Stale,
    PermissionDenied
}

public sealed record EvidenceCell<T>(
    EvidenceStatus Status,
    T? Value,
    double? Confidence,
    string Provenance,
    string? Reason = null);

public static class Evidence
{
    public static EvidenceCell<T> Known<T>(T value, string provenance, double? confidence = null) =>
        new(EvidenceStatus.Known, value, confidence, provenance);

    public static EvidenceCell<T> Unknown<T>(string provenance, string? reason = null) =>
        new(EvidenceStatus.Unknown, default, null, provenance, reason);

    public static EvidenceCell<T> Unavailable<T>(string provenance, string reason) =>
        new(EvidenceStatus.Unavailable, default, null, provenance, reason);

    public static EvidenceCell<object?> NotApplicableNative() =>
        new(EvidenceStatus.NotApplicable, null, null, "server", "requires_native_sdk");
}
