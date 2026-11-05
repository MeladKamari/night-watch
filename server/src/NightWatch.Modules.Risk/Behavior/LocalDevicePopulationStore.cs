using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace NightWatch.Modules.Risk.Behavior;

/// <summary>
/// Tenant-local device attribute population for rare-device scoring (not a global SaaS baseline).
/// </summary>
public sealed class LocalDevicePopulationStore
{
    private readonly ConcurrentDictionary<string, long> _counts = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, long> _tenantTotals = new(StringComparer.Ordinal);

    public long Total => _tenantTotals.Values.Sum();

    public void Observe(string tenantId, IReadOnlyDictionary<string, string?>? attrs)
    {
        var sig = Signature(tenantId, attrs);
        if (sig is null) return;
        _counts.AddOrUpdate(sig, 1, (_, c) => c + 1);
        _tenantTotals.AddOrUpdate(tenantId, 1, (_, c) => c + 1);
    }

    public (double Rarity, long CohortCount, long PopulationTotal, string Status) Query(
        string tenantId,
        IReadOnlyDictionary<string, string?>? attrs)
    {
        _tenantTotals.TryGetValue(tenantId, out var total);
        var sig = Signature(tenantId, attrs);
        if (sig is null || total < 5)
        {
            return (0, 0, total, "insufficient_population");
        }

        _counts.TryGetValue(sig, out var count);
        // Rarity: 1 = unique so far, 0 = very common
        var rarity = 1.0 - (double)count / total;
        return (Math.Clamp(rarity, 0, 1), count, total, "local_baseline");
    }

    private static string? Signature(string tenantId, IReadOnlyDictionary<string, string?>? attrs)
    {
        if (attrs is null || attrs.Count == 0) return null;
        var ordered = attrs
            .Where(kv => !kv.Key.StartsWith('_') && !string.IsNullOrWhiteSpace(kv.Value))
            .OrderBy(kv => kv.Key, StringComparer.Ordinal)
            .Select(kv => $"{kv.Key}={kv.Value}");
        var material = $"{tenantId}|{string.Join('&', ordered)}";
        if (material.Length < tenantId.Length + 3) return null;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material))).ToLowerInvariant()[..24];
    }
}
