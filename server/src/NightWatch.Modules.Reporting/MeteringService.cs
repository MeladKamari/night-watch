using System.Collections.Concurrent;
using System.Text;

namespace NightWatch.Modules.Reporting;

public sealed class MeteringOptions
{
    public int DefaultMonthlyQuota { get; set; } = 10_000;
}

public sealed class QuotaDecision
{
    public required bool Accepted { get; init; }
    public required string Code { get; init; }
    public required long Used { get; init; }
    public required long Quota { get; init; }
    public bool AlreadyAcceptedPreserved { get; init; }
}

public interface IMeteringService
{
    void ProvisionQuota(string tenantId, string projectId, string environmentId, long monthlyQuota, bool freeTrial = false);
    QuotaDecision TryAcceptIngest(string tenantId, string projectId, string environmentId, string eventId);
    long GetUsage(string tenantId, string projectId, string environmentId);
    string ExportInvoiceCsv(string tenantId, string projectId, string environmentId, string period);
}

public sealed class MeteringService(MeteringOptions? options = null) : IMeteringService
{
    private readonly MeteringOptions _options = options ?? new MeteringOptions();
    private readonly ConcurrentDictionary<string, long> _quota = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, long> _usage = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, byte> _acceptedEvents = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, byte> _freeTrial = new(StringComparer.Ordinal);

    private static string Scope(string t, string p, string e) => $"{t}:{p}:{e}";

    public void ProvisionQuota(string tenantId, string projectId, string environmentId, long monthlyQuota, bool freeTrial = false)
    {
        var s = Scope(tenantId, projectId, environmentId);
        _quota[s] = monthlyQuota;
        if (freeTrial) _freeTrial[s] = 1;
    }

    public QuotaDecision TryAcceptIngest(string tenantId, string projectId, string environmentId, string eventId)
    {
        var s = Scope(tenantId, projectId, environmentId);
        var quota = _quota.GetOrAdd(s, _options.DefaultMonthlyQuota);

        if (_acceptedEvents.ContainsKey($"{s}:{eventId}"))
        {
            return new QuotaDecision
            {
                Accepted = true,
                Code = "already_accepted",
                Used = _usage.GetValueOrDefault(s),
                Quota = quota,
                AlreadyAcceptedPreserved = true
            };
        }

        var used = _usage.AddOrUpdate(s, 1, (_, v) => v + 1);
        if (used > quota)
        {
            _usage.AddOrUpdate(s, 0, (_, v) => Math.Max(0, v - 1));
            return new QuotaDecision
            {
                Accepted = false,
                Code = "quota_exceeded",
                Used = _usage.GetValueOrDefault(s),
                Quota = quota
            };
        }

        _acceptedEvents[$"{s}:{eventId}"] = 1;
        return new QuotaDecision
        {
            Accepted = true,
            Code = _freeTrial.ContainsKey(s) ? "accepted_free_trial" : "accepted",
            Used = used,
            Quota = quota
        };
    }

    public long GetUsage(string tenantId, string projectId, string environmentId) =>
        _usage.GetValueOrDefault(Scope(tenantId, projectId, environmentId));

    public string ExportInvoiceCsv(string tenantId, string projectId, string environmentId, string period)
    {
        var s = Scope(tenantId, projectId, environmentId);
        var sb = new StringBuilder();
        sb.AppendLine("tenant,project,environment,period,usage,quota,freeTrial,paymentGateway");
        sb.Append(tenantId).Append(',')
            .Append(projectId).Append(',')
            .Append(environmentId).Append(',')
            .Append(period).Append(',')
            .Append(GetUsage(tenantId, projectId, environmentId)).Append(',')
            .Append(_quota.GetValueOrDefault(s, _options.DefaultMonthlyQuota)).Append(',')
            .Append(_freeTrial.ContainsKey(s)).Append(',')
            .Append("none_self_hosted");
        return sb.ToString();
    }
}
