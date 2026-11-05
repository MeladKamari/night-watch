using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NightWatch.Modules.Risk.Rules;

namespace NightWatch.Modules.Risk.Investigation;

// --- STEP 081: fraud ring graph ---

public sealed record GraphNode(string Id, string Kind); // device | account | ip

public sealed record GraphEdge(string From, string To, string Reason, double Confidence, bool CgnatRisk);

public sealed record RingLead(
    string ComponentId,
    IReadOnlyList<string> NodeIds,
    double Score,
    string Status, // investigation_lead | insufficient_evidence
    IReadOnlyList<string> Explanations);

public sealed class FraudRingGraph
{
    private readonly List<GraphEdge> _edges = new();
    private readonly HashSet<string> _cgnatIps = new(StringComparer.Ordinal);

    public void MarkCgnatPrefix(string ipOrPrefix) => _cgnatIps.Add(ipOrPrefix);

    public void Link(string from, string to, string reason, double confidence, string? ipForCgnatCheck = null)
    {
        var cgnat = ipForCgnatCheck is not null && _cgnatIps.Any(p => ipForCgnatCheck.StartsWith(p, StringComparison.Ordinal));
        var conf = cgnat ? Math.Min(confidence, 0.15) : confidence;
        _edges.Add(new GraphEdge(from, to, reason, conf, cgnat));
    }

    public IReadOnlyList<RingLead> DetectLeads(double minConfidence = 0.5, int minNodes = 3)
    {
        var adj = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var e in _edges.Where(e => e.Confidence >= minConfidence && !e.CgnatRisk))
        {
            if (!adj.TryGetValue(e.From, out var a)) adj[e.From] = a = new HashSet<string>(StringComparer.Ordinal);
            if (!adj.TryGetValue(e.To, out var b)) adj[e.To] = b = new HashSet<string>(StringComparer.Ordinal);
            a.Add(e.To);
            b.Add(e.From);
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var leads = new List<RingLead>();
        foreach (var start in adj.Keys)
        {
            if (!seen.Add(start)) continue;
            var stack = new Stack<string>();
            stack.Push(start);
            var comp = new List<string>();
            while (stack.Count > 0)
            {
                var n = stack.Pop();
                comp.Add(n);
                if (!adj.TryGetValue(n, out var nbrs)) continue;
                foreach (var x in nbrs)
                {
                    if (seen.Add(x)) stack.Push(x);
                }
            }

            var status = comp.Count >= minNodes ? "investigation_lead" : "insufficient_evidence";
            var score = Math.Min(1.0, comp.Count / 10.0);
            leads.Add(new RingLead($"comp_{leads.Count + 1}", comp, score, status,
                [$"component_size={comp.Count}", "not_definitive_fraud"]));
        }

        return leads;
    }
}

// --- STEP 082: analyst review queue ---

public enum CaseStatus { Open, Assigned, PendingChecker, Resolved, Reversed, LegalHold }

public sealed record FraudCase(
    string CaseId,
    string TenantId,
    string Assignee,
    CaseStatus Status,
    string Maker,
    string? Checker,
    bool HighRiskIrreversible,
    IReadOnlyList<string> EvidenceMasked,
    IReadOnlyList<string> History);

public sealed class AnalystReviewQueue
{
    private readonly ConcurrentDictionary<string, FraudCase> _cases = new(StringComparer.Ordinal);

    public FraudCase Open(string tenantId, string maker, bool highRisk, IEnumerable<string> evidence)
    {
        var id = "case_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{tenantId}|{maker}|{DateTimeOffset.UtcNow.Ticks}")))[..12].ToLowerInvariant();
        var c = new FraudCase(id, tenantId, maker, CaseStatus.Assigned, maker, null, highRisk, evidence.Select(Mask).ToList(), [$"opened_by={maker}"]);
        _cases[id] = c;
        return c;
    }

    public FraudCase Approve(string caseId, string actor)
    {
        if (!_cases.TryGetValue(caseId, out var c)) throw new InvalidOperationException("case_missing");
        if (c.HighRiskIrreversible && string.Equals(actor, c.Maker, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("maker_checker_violation");
        }

        var next = c with
        {
            Checker = actor,
            Status = CaseStatus.Resolved,
            History = c.History.Append($"approved_by={actor}").ToList()
        };
        _cases[caseId] = next;
        return next;
    }

    public FraudCase Reverse(string caseId, string actor)
    {
        var c = _cases[caseId];
        var next = c with { Status = CaseStatus.Reversed, History = c.History.Append($"reversed_by={actor}").ToList() };
        _cases[caseId] = next;
        return next;
    }

    public FraudCase LegalHold(string caseId, string actor)
    {
        var c = _cases[caseId];
        var next = c with { Status = CaseStatus.LegalHold, History = c.History.Append($"legal_hold_by={actor}").ToList() };
        _cases[caseId] = next;
        return next;
    }

    public string ExportMasked(string caseId)
    {
        var c = _cases[caseId];
        return JsonSerializer.Serialize(new
        {
            c.CaseId,
            c.TenantId,
            c.Status,
            evidence = c.EvidenceMasked,
            provenance = c.History
        });
    }

    public IReadOnlyList<FraudCase> List(string tenantId) =>
        _cases.Values.Where(c => c.TenantId == tenantId).OrderBy(c => c.CaseId).ToList();

    public FraudCase? TryGet(string caseId) =>
        _cases.TryGetValue(caseId, out var c) ? c : null;

    private static string Mask(string s)
    {
        if (s.Contains('@')) return "***@***";
        if (s.Length <= 4) return "****";
        return s[..2] + new string('*', s.Length - 4) + s[^2..];
    }
}

// --- STEP 083: SIEM/SOAR ---

public sealed record ThreatObservable(string Type, string Value, DateTimeOffset ExpiresAt);

public sealed class SiemSoarBridge
{
    private readonly ConcurrentDictionary<string, ThreatObservable> _iocs = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, byte> _dedupe = new(StringComparer.Ordinal);
    private readonly List<string> _deadLetter = new();
    private readonly byte[] _signKey;

    public SiemSoarBridge(string signKey = "night-watch-dev-siem-key") => _signKey = Encoding.UTF8.GetBytes(signKey);

    public IReadOnlyList<string> DeadLetter => _deadLetter;

    public bool ImportStixLike(string json, DateTimeOffset now)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("observables", out var arr) || arr.ValueKind != JsonValueKind.Array)
            {
                _deadLetter.Add("malformed_missing_observables");
                return false;
            }

            foreach (var o in arr.EnumerateArray())
            {
                var type = o.GetProperty("type").GetString() ?? "";
                var value = o.GetProperty("value").GetString() ?? "";
                var exp = o.TryGetProperty("expiresAt", out var e) ? e.GetDateTimeOffset() : now.AddDays(1);
                if (string.IsNullOrWhiteSpace(type) || string.IsNullOrWhiteSpace(value)) continue;
                var key = $"{type}|{value}";
                if (!_dedupe.TryAdd(key, 0)) continue;
                if (exp <= now) continue;
                _iocs[key] = new ThreatObservable(type, value, exp);
            }

            return true;
        }
        catch
        {
            _deadLetter.Add("malformed_json");
            return false;
        }
    }

    public string ExportCef(string tenantId, string eventType, IReadOnlyDictionary<string, string> fields)
    {
        var masked = fields.ToDictionary(kv => kv.Key, kv => kv.Key.Contains("email", StringComparison.OrdinalIgnoreCase) ? "***" : kv.Value);
        var body = $"CEF:0|NightWatch|NightWatch|1|{eventType}|risk|{tenantId}|{JsonSerializer.Serialize(masked)}";
        var sig = Convert.ToHexString(HMACSHA256.HashData(_signKey, Encoding.UTF8.GetBytes(body))).ToLowerInvariant()[..16];
        return $"{body}|sig={sig}";
    }

    public bool HasIoc(string type, string value) => _iocs.ContainsKey($"{type}|{value}");
}

// --- STEP 084: reference policies ---

public static class FraudUseCaseTemplates
{
    public static IReadOnlyList<PolicyDocument> AllDisabled(string tenantId) =>
    [
        Template(tenantId, "ato", "ATO", new AndExpr([
            new CmpExpr("suspect_score", CompareOp.Gte, 50),
            new CmpExpr("signal.browser_bot_detection", CompareOp.Neq, "detected")
        ]), RuleAction.Challenge),
        Template(tenantId, "credential_stuffing", "Credential stuffing", new CmpExpr("visitor.events_last_hour", CompareOp.Gte, 40), RuleAction.Challenge),
        Template(tenantId, "sms_abuse", "SMS abuse", new CmpExpr("suspect_score", CompareOp.Gte, 60), RuleAction.ManualReview),
        Template(tenantId, "onboarding", "Onboarding", new CmpExpr("suspect_score", CompareOp.Gte, 55), RuleAction.Challenge),
        Template(tenantId, "account_sharing", "Account sharing", new CmpExpr("suspect_score", CompareOp.Gte, 70), RuleAction.Observe),
        Template(tenantId, "loan_fraud", "Loan fraud", new AndExpr([
            new CmpExpr("suspect_score", CompareOp.Gte, 65),
            new CmpExpr("signal.tampered_request_detection", CompareOp.Eq, "detected")
        ]), RuleAction.ManualReview)
    ];

    private static PolicyDocument Template(string tenantId, string id, string title, RuleExpr when, RuleAction action) =>
        new(tenantId, $"tpl-{id}-v1",
        [
            new PolicyRule($"tpl-{id}", 10, when, action, null, null, DryRun: true)
        ]);
}

// --- STEP 085: fairness oversight ---

public sealed record CohortMetric(string CohortKey, int Decisions, int Rejects, double RejectRate);

public sealed record FairnessAlert(string Code, string CohortKey, string Message);

public sealed class FairnessOversight
{
    private readonly List<CohortMetric> _metrics = new();
    private string? _activeShadowVersion;

    public void Record(string browserFamily, string os, string locale, string accessMode, string? geo, bool rejected)
    {
        // Never accept ethnicity/religion keys
        var key = $"{browserFamily}|{os}|{locale}|{accessMode}|{geo ?? "unknown"}";
        var existing = _metrics.FirstOrDefault(m => m.CohortKey == key);
        if (existing is null)
        {
            _metrics.Add(new CohortMetric(key, 1, rejected ? 1 : 0, rejected ? 1 : 0));
        }
        else
        {
            var decisions = existing.Decisions + 1;
            var rejects = existing.Rejects + (rejected ? 1 : 0);
            _metrics.Remove(existing);
            _metrics.Add(new CohortMetric(key, decisions, rejects, rejects / (double)decisions));
        }
    }

    public IReadOnlyList<FairnessAlert> DetectSkew(double baselineRejectRate, double delta = 0.25)
    {
        return _metrics
            .Where(m => m.Decisions >= 5 && m.RejectRate >= baselineRejectRate + delta)
            .Select(m => new FairnessAlert("cohort_skew", m.CohortKey, $"reject_rate={m.RejectRate:F2}"))
            .ToList();
    }

    public void StartShadow(string version) => _activeShadowVersion = version;

    public string? RollbackShadow()
    {
        var v = _activeShadowVersion;
        _activeShadowVersion = null;
        return v;
    }

    public string? ActiveShadow => _activeShadowVersion;
}
