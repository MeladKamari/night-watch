namespace NightWatch.Modules.Risk.Rules;

public enum RuleAction
{
    Allow,
    Log,
    Observe,
    Challenge,
    ManualReview,
    Deny
}

public enum CompareOp
{
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    In,
    Exists
}

public abstract record RuleExpr;

public sealed record CmpExpr(string Field, CompareOp Op, object? Value) : RuleExpr;

public sealed record AndExpr(IReadOnlyList<RuleExpr> Items) : RuleExpr;

public sealed record OrExpr(IReadOnlyList<RuleExpr> Items) : RuleExpr;

public sealed record NotExpr(RuleExpr Inner) : RuleExpr;

public sealed record PolicyRule(
    string RuleId,
    int Priority,
    RuleExpr When,
    RuleAction Action,
    string? Scope,
    IReadOnlyList<string>? Exceptions,
    bool DryRun);

public sealed record PolicyDocument(
    string TenantId,
    string Revision,
    IReadOnlyList<PolicyRule> Rules);

public sealed record RuleEvaluation(
    string RuleId,
    bool Matched,
    RuleAction Action,
    bool DryRun,
    string Explanation);

public sealed record PolicyDecision(
    string TenantId,
    string Revision,
    RuleAction EffectiveAction,
    IReadOnlyList<RuleEvaluation> Matches,
    IReadOnlyList<string> ValidationErrors,
    bool Simulated);

public sealed class RulesEngine
{
    private readonly Dictionary<string, PolicyDocument> _policies = new(StringComparer.Ordinal);
    private readonly Stack<(string TenantId, PolicyDocument Doc)> _history = new();

    private static readonly HashSet<string> AllowedFields = new(StringComparer.Ordinal)
    {
        "suspect_score",
        "signal.browser_bot_detection",
        "signal.vpn_detection",
        "signal.tampered_request_detection",
        "visitor.events_last_hour",
        "request.path",
        "tenant.id"
    };

    public void Publish(PolicyDocument doc)
    {
        var errors = Validate(doc);
        if (errors.Count > 0)
        {
            throw new InvalidOperationException("policy_invalid:" + string.Join(",", errors));
        }

        if (_policies.TryGetValue(doc.TenantId, out var prev))
        {
            _history.Push((doc.TenantId, prev));
        }

        _policies[doc.TenantId] = doc;
    }

    public bool Rollback(string tenantId)
    {
        if (_history.Count == 0) return false;
        var (tid, doc) = _history.Pop();
        if (tid != tenantId)
        {
            _history.Push((tid, doc));
            return false;
        }

        _policies[tenantId] = doc;
        return true;
    }

    public PolicyDocument? GetPolicy(string tenantId) =>
        _policies.TryGetValue(tenantId, out var doc) ? doc : null;

    public IReadOnlyList<string> Validate(PolicyDocument doc)
    {
        var errors = new List<string>();
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var rule in doc.Rules)
        {
            if (!ids.Add(rule.RuleId)) errors.Add($"duplicate_rule:{rule.RuleId}");
            errors.AddRange(ValidateExpr(rule.When));
        }

        return errors;
    }

    public PolicyDecision Evaluate(string tenantId, IReadOnlyDictionary<string, object?> facts, bool simulate = false)
    {
        if (!_policies.TryGetValue(tenantId, out var doc))
        {
            return new PolicyDecision(tenantId, "none", RuleAction.Allow, [], ["policy_missing"], simulate);
        }

        var matches = new List<RuleEvaluation>();
        foreach (var rule in doc.Rules.OrderByDescending(r => r.Priority))
        {
            if (rule.Exceptions is { Count: > 0 } && facts.TryGetValue("tenant.id", out var tid) &&
                rule.Exceptions.Contains(Convert.ToString(tid), StringComparer.Ordinal))
            {
                continue;
            }

            if (rule.Scope is not null && facts.TryGetValue("request.path", out var path) &&
                path is string ps && !ps.StartsWith(rule.Scope, StringComparison.Ordinal))
            {
                continue;
            }

            var matched = Eval(rule.When, facts);
            if (!matched) continue;

            var effective = rule.DryRun || simulate ? RuleAction.Observe : rule.Action;
            matches.Add(new RuleEvaluation(rule.RuleId, true, effective, rule.DryRun || simulate, Explain(rule)));
        }

        var action = matches.Count == 0
            ? RuleAction.Allow
            : matches.Select(m => m.Action).Aggregate(MostRestrictive);

        return new PolicyDecision(tenantId, doc.Revision, action, matches, [], simulate);
    }

    private static RuleAction MostRestrictive(RuleAction a, RuleAction b)
    {
        static int Rank(RuleAction x) => x switch
        {
            RuleAction.Deny => 5,
            RuleAction.ManualReview => 4,
            RuleAction.Challenge => 3,
            RuleAction.Observe => 2,
            RuleAction.Log => 1,
            _ => 0
        };
        return Rank(a) >= Rank(b) ? a : b;
    }

    private static string Explain(PolicyRule rule) =>
        $"rule={rule.RuleId};priority={rule.Priority};action={rule.Action};dry_run={rule.DryRun}";

    private static IEnumerable<string> ValidateExpr(RuleExpr expr) =>
        expr switch
        {
            CmpExpr c when !AllowedFields.Contains(c.Field) => [$"field_not_allowed:{c.Field}"],
            CmpExpr c when ContainsInjection(c.Field) || ContainsInjection(Convert.ToString(c.Value)) => ["injection_blocked"],
            AndExpr a => a.Items.SelectMany(ValidateExpr),
            OrExpr o => o.Items.SelectMany(ValidateExpr),
            NotExpr n => ValidateExpr(n.Inner),
            _ => []
        };

    private static bool ContainsInjection(string? s) =>
        s is not null && (s.Contains("=>", StringComparison.Ordinal) ||
                          s.Contains("System.", StringComparison.Ordinal) ||
                          s.Contains("Eval(", StringComparison.OrdinalIgnoreCase) ||
                          s.Contains("{{", StringComparison.Ordinal) ||
                          s.Contains("`"));

    private static bool Eval(RuleExpr expr, IReadOnlyDictionary<string, object?> facts) =>
        expr switch
        {
            AndExpr a => a.Items.All(i => Eval(i, facts)),
            OrExpr o => o.Items.Any(i => Eval(i, facts)),
            NotExpr n => !Eval(n.Inner, facts),
            CmpExpr c => EvalCmp(c, facts),
            _ => false
        };

    private static bool EvalCmp(CmpExpr c, IReadOnlyDictionary<string, object?> facts)
    {
        facts.TryGetValue(c.Field, out var left);
        return c.Op switch
        {
            CompareOp.Exists => left is not null,
            CompareOp.Eq => EqualsNormalized(left, c.Value),
            CompareOp.Neq => !EqualsNormalized(left, c.Value),
            CompareOp.Gt => AsDouble(left) > AsDouble(c.Value),
            CompareOp.Gte => AsDouble(left) >= AsDouble(c.Value),
            CompareOp.Lt => AsDouble(left) < AsDouble(c.Value),
            CompareOp.Lte => AsDouble(left) <= AsDouble(c.Value),
            CompareOp.In => c.Value is IEnumerable<object> set && set.Any(v => EqualsNormalized(left, v)),
            _ => false
        };
    }

    private static bool EqualsNormalized(object? a, object? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;
        if (a is IConvertible && b is IConvertible)
        {
            try
            {
                return Convert.ToDouble(a).Equals(Convert.ToDouble(b)) ||
                       string.Equals(Convert.ToString(a), Convert.ToString(b), StringComparison.Ordinal);
            }
            catch
            {
                return string.Equals(Convert.ToString(a), Convert.ToString(b), StringComparison.Ordinal);
            }
        }

        return Equals(a, b);
    }

    private static double AsDouble(object? v) =>
        v is null ? double.NaN : Convert.ToDouble(v);
}
