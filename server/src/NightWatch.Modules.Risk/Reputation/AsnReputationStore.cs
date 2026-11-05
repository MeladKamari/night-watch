using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Risk.Reputation;

public sealed record ReputationRecord(
    string Key, // asn:1234 | ip:1.2.3.4 | tag:tor
    string Kind, // asn | country | vpn | proxy | dc | tor | abuse | ir_operator | cellular
    string Label,
    DateTimeOffset ExpiresAt,
    string Provenance);

public sealed record FeedImportResult(
    bool Accepted,
    string Status, // imported | rejected_signature | rejected_license | stale | conflict
    int RecordCount,
    IReadOnlyList<string> Conflicts);

/// <summary>
/// Offline signed ASN/IP reputation feeds for Self-hosted deployments. No runtime external fetch.
/// </summary>
public sealed class AsnReputationStore
{
    private readonly ConcurrentDictionary<string, ReputationRecord> _records = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, ReputationRecord> _overrides = new(StringComparer.Ordinal);
    private readonly byte[] _signingKey;

    public AsnReputationStore(string signingKey = "night-watch-dev-feed-signing-key")
    {
        _signingKey = Encoding.UTF8.GetBytes(signingKey);
    }

    public FeedImportResult ImportSignedBundle(string jsonPayload, string signatureHex, string licenseTag, DateTimeOffset now)
    {
        if (licenseTag is not ("offline_feed_v1" or "lab_synthetic_v1"))
        {
            return new FeedImportResult(false, "rejected_license", 0, []);
        }

        var expect = Convert.ToHexString(HMACSHA256.HashData(_signingKey, Encoding.UTF8.GetBytes(jsonPayload))).ToLowerInvariant();
        var a = Encoding.UTF8.GetBytes(expect);
        var b = Encoding.UTF8.GetBytes(signatureHex.ToLowerInvariant());
        if (a.Length != b.Length || !CryptographicOperations.FixedTimeEquals(a, b))
        {
            return new FeedImportResult(false, "rejected_signature", 0, []);
        }

        List<ReputationRecord>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<ReputationRecord>>(jsonPayload);
        }
        catch
        {
            return new FeedImportResult(false, "rejected_signature", 0, []);
        }

        if (items is null || items.Count == 0)
        {
            return new FeedImportResult(false, "rejected_signature", 0, []);
        }

        var conflicts = new List<string>();
        var imported = 0;
        foreach (var item in items)
        {
            if (item.ExpiresAt <= now)
            {
                continue;
            }

            // IR operators / cellular never imply guilt — stored as metadata labels only
            if (item.Kind is "ir_operator" or "cellular" && item.Label.Contains("malicious", StringComparison.OrdinalIgnoreCase))
            {
                conflicts.Add($"guilt_forbidden:{item.Key}");
                continue;
            }

            if (_records.TryGetValue(item.Key, out var existing) && existing.Label != item.Label)
            {
                conflicts.Add($"conflict:{item.Key}");
            }

            _records[item.Key] = item;
            imported++;
        }

        return new FeedImportResult(true, conflicts.Count > 0 ? "conflict" : "imported", imported, conflicts);
    }

    public void AnalystOverride(ReputationRecord record) => _overrides[record.Key] = record;

    public (string Status, ReputationRecord? Record) Lookup(string key, DateTimeOffset now)
    {
        if (_overrides.TryGetValue(key, out var o))
        {
            return o.ExpiresAt <= now ? ("stale", null) : ("known", o);
        }

        if (!_records.TryGetValue(key, out var r))
        {
            return ("unknown", null);
        }

        return r.ExpiresAt <= now ? ("stale", null) : ("known", r);
    }

    public static string SignForTests(string signingKey, string jsonPayload) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(jsonPayload))).ToLowerInvariant();
}
