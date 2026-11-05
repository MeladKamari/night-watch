using System.Collections.Concurrent;
using System.Text.Json;

namespace NightWatch.Modules.Identity.Matching;

public sealed record StoredDeviceVector(
    string TenantId,
    string Namespace,
    string VisitorId,
    string? ContinuityId,
    string? BlockKey,
    IReadOnlyDictionary<string, string?> Features,
    DateTimeOffset ObservedAt,
    string VectorVersion);

public interface IDeviceVectorDurableSink
{
    void Upsert(StoredDeviceVector vector);
    IReadOnlyList<StoredDeviceVector> LoadAll();
}

public interface IDeviceVectorStore
{
    void Upsert(StoredDeviceVector vector);
    StoredDeviceVector? Get(string tenantId, string visitorId);
    IReadOnlyList<StoredDeviceVector> ListNamespace(string tenantId, string ns, int max = 64);
    void DeleteVisitor(string tenantId, string visitorId);
    void Hydrate(IEnumerable<StoredDeviceVector> vectors);
}

/// <summary>
/// Hot-path device vectors for fuzzy/continuity matching. Dual-writes to optional durable sink.
/// </summary>
public sealed class DeviceVectorStore(IDeviceVectorDurableSink? durable = null) : IDeviceVectorStore
{
    private readonly ConcurrentDictionary<string, StoredDeviceVector> _byVisitor = new(StringComparer.Ordinal);

    private static string Key(string tenantId, string visitorId) => $"{tenantId}|{visitorId}";

    public void Upsert(StoredDeviceVector vector)
    {
        _byVisitor[Key(vector.TenantId, vector.VisitorId)] = vector;
        try
        {
            durable?.Upsert(vector);
        }
        catch
        {
            // Durable sink failures must not break identify hot path.
        }
    }

    public StoredDeviceVector? Get(string tenantId, string visitorId) =>
        _byVisitor.TryGetValue(Key(tenantId, visitorId), out var v) ? v : null;

    public IReadOnlyList<StoredDeviceVector> ListNamespace(string tenantId, string ns, int max = 64) =>
        _byVisitor.Values
            .Where(v => v.TenantId == tenantId && v.Namespace == ns)
            .OrderByDescending(v => v.ObservedAt)
            .Take(Math.Clamp(max, 1, 200))
            .ToList();

    public void DeleteVisitor(string tenantId, string visitorId) =>
        _byVisitor.TryRemove(Key(tenantId, visitorId), out _);

    public void Hydrate(IEnumerable<StoredDeviceVector> vectors)
    {
        foreach (var v in vectors)
        {
            _byVisitor[Key(v.TenantId, v.VisitorId)] = v;
        }
    }

    public static string SerializeFeatures(IReadOnlyDictionary<string, string?> features) =>
        JsonSerializer.Serialize(features);

    public static Dictionary<string, string?> DeserializeFeatures(string json)
    {
        try
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, string?>>(json);
            return map is null
                ? new Dictionary<string, string?>(StringComparer.Ordinal)
                : new Dictionary<string, string?>(map, StringComparer.Ordinal);
        }
        catch
        {
            return new Dictionary<string, string?>(StringComparer.Ordinal);
        }
    }
}
