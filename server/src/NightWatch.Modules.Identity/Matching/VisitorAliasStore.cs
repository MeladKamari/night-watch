using System.Collections.Concurrent;

namespace NightWatch.Modules.Identity.Matching;

public sealed record StoredVisitorAlias(
    string TenantId,
    string Namespace,
    string AliasKind,
    string AliasValue,
    string VisitorId,
    DateTimeOffset UpdatedAt);

public interface IVisitorAliasDurableSink
{
    void Upsert(StoredVisitorAlias alias);
    IReadOnlyList<StoredVisitorAlias> LoadAll();
}

public interface IVisitorAliasStore
{
    void Upsert(StoredVisitorAlias alias);
    string? Resolve(string ns, string aliasKind, string aliasValue);
    void DeleteVisitor(string visitorId);
    void Hydrate(IEnumerable<StoredVisitorAlias> aliases);
}

public sealed class VisitorAliasStore(IVisitorAliasDurableSink? durable = null) : IVisitorAliasStore
{
    private readonly ConcurrentDictionary<string, StoredVisitorAlias> _map = new(StringComparer.Ordinal);

    private static string Key(string ns, string kind, string value) => $"{ns}|{kind}|{value}";

    public void Upsert(StoredVisitorAlias alias)
    {
        _map[Key(alias.Namespace, alias.AliasKind, alias.AliasValue)] = alias;
        try { durable?.Upsert(alias); } catch { /* hot path */ }
    }

    public string? Resolve(string ns, string aliasKind, string aliasValue) =>
        _map.TryGetValue(Key(ns, aliasKind, aliasValue), out var a) ? a.VisitorId : null;

    public void DeleteVisitor(string visitorId)
    {
        foreach (var key in _map.Where(kv => kv.Value.VisitorId == visitorId).Select(kv => kv.Key).ToList())
        {
            _map.TryRemove(key, out _);
        }
    }

    public void Hydrate(IEnumerable<StoredVisitorAlias> aliases)
    {
        foreach (var a in aliases)
        {
            _map[Key(a.Namespace, a.AliasKind, a.AliasValue)] = a;
        }
    }
}
