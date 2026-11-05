using System.Collections.Concurrent;
using System.Collections.Immutable;

namespace NightWatch.Modules.Identity;

public sealed record EventAnnotationState(
    string EventId,
    string TenantId,
    long Revision,
    string? LinkedId,
    /// <summary>Heuristic / automated suspect — not verified adjudication.</summary>
    string HeuristicSuspect,
    /// <summary>Verified operator label: none | legitimate | fraud | unknown</summary>
    string AdjudicatedLabel,
    IReadOnlyList<string> Tags,
    string? LastActor,
    string? LastReason,
    DateTimeOffset? UpdatedAt);

public sealed record AnnotationAuditEntry(
    string EventId,
    string TenantId,
    long RevisionBefore,
    long RevisionAfter,
    string Actor,
    string Action,
    string? Reason,
    string? EvidenceRef,
    DateTimeOffset At,
    string PayloadSummary);

public sealed class PatchEventAnnotationRequest
{
    public string? LinkedId { get; set; }
    public string? HeuristicSuspect { get; set; } // unknown | unavailable | yes | no
    public List<string>? Tags { get; set; }
    public string? Reason { get; set; }
    public long? IfMatchRevision { get; set; }
}

public sealed class PostEventFeedbackRequest
{
    public string? Label { get; set; } // legitimate | fraud | unknown
    public string? Reason { get; set; }
    public string? EvidenceRef { get; set; }
    public long? IfMatchRevision { get; set; }
}

public interface IEventAnnotationService
{
    (int StatusCode, object Body) GetAnnotation(string eventId, string? tenantId, string? apiKeyKind);
    (int StatusCode, object Body) Patch(
        string eventId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? ifMatchHeader,
        PatchEventAnnotationRequest? body);
    (int StatusCode, object Body) PostFeedback(
        string eventId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? ifMatchHeader,
        PostEventFeedbackRequest? body);
    IReadOnlyList<AnnotationAuditEntry> GetAudit(string eventId, string tenantId);
}

public sealed class EventAnnotationService(IIdentificationEventCatalog catalog) : IEventAnnotationService
{
    private readonly ConcurrentDictionary<string, EventAnnotationState> _state = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, ImmutableList<AnnotationAuditEntry>> _audit = new(StringComparer.Ordinal);

    public (int StatusCode, object Body) GetAnnotation(string eventId, string? tenantId, string? apiKeyKind)
    {
        if (!Auth(apiKeyKind, out var problem) || !RequireTenant(tenantId, out problem))
        {
            return problem;
        }

        var ev = catalog.GetByEventId(eventId);
        if (ev is null || ev.TenantId != tenantId)
        {
            return Problem(404, "event_not_found", "Event not found");
        }

        var state = _state.GetOrAdd(Key(tenantId!, eventId), _ => DefaultState(eventId, tenantId!));
        return (200, state);
    }

    public (int StatusCode, object Body) Patch(
        string eventId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? ifMatchHeader,
        PatchEventAnnotationRequest? body)
    {
        if (!Auth(apiKeyKind, out var problem) || !RequireTenant(tenantId, out problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(actor))
        {
            return Problem(400, "actor_required", "X-Actor-Id required");
        }

        if (body is null)
        {
            return Problem(400, "body_required", "JSON body required");
        }

        var ev = catalog.GetByEventId(eventId);
        if (ev is null || ev.TenantId != tenantId)
        {
            return Problem(404, "event_not_found", "Event not found");
        }

        // Never mutate original observation signals — annotations are side-car only.
        var key = Key(tenantId!, eventId);
        while (true)
        {
            var current = _state.GetOrAdd(key, _ => DefaultState(eventId, tenantId!));
            var expected = ResolveExpectedRevision(ifMatchHeader, body.IfMatchRevision);
            if (expected is not null && expected != current.Revision)
            {
                return Problem(409, "revision_conflict", $"Expected revision {expected}, current {current.Revision}");
            }

            if (body.HeuristicSuspect is not null
                && body.HeuristicSuspect is not ("unknown" or "unavailable" or "yes" or "no"))
            {
                return Problem(400, "suspect_invalid", "heuristicSuspect invalid");
            }

            if (body.Tags is not null && body.Tags.Any(t => string.Equals(t, "applePay", StringComparison.Ordinal)))
            {
                return Problem(400, "apple_pay_forbidden", "applePay tag excluded");
            }

            var next = current with
            {
                Revision = current.Revision + 1,
                LinkedId = body.LinkedId ?? current.LinkedId,
                HeuristicSuspect = body.HeuristicSuspect ?? current.HeuristicSuspect,
                Tags = body.Tags?.ToList() ?? current.Tags.ToList(),
                LastActor = actor,
                LastReason = body.Reason,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (!_state.TryUpdate(key, next, current))
            {
                continue; // concurrent writer — retry or conflict on next If-Match
            }

            AppendAudit(new AnnotationAuditEntry(
                eventId,
                tenantId!,
                current.Revision,
                next.Revision,
                actor,
                "patch",
                body.Reason,
                null,
                DateTimeOffset.UtcNow,
                "tags_linked_suspect"));

            // Reflect searchable linkedId / heuristic suspect on catalog without touching observation payload.
            catalog.Upsert(ev with
            {
                LinkedId = next.LinkedId,
                SuspectStatus = next.HeuristicSuspect,
                Sequence = ev.Sequence
            });

            return (200, next);
        }
    }

    public (int StatusCode, object Body) PostFeedback(
        string eventId,
        string? tenantId,
        string? apiKeyKind,
        string? actor,
        string? ifMatchHeader,
        PostEventFeedbackRequest? body)
    {
        if (!Auth(apiKeyKind, out var problem) || !RequireTenant(tenantId, out problem))
        {
            return problem;
        }

        if (string.IsNullOrWhiteSpace(actor))
        {
            return Problem(400, "actor_required", "X-Actor-Id required");
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Label))
        {
            return Problem(400, "label_required", "feedback label required");
        }

        if (body.Label is not ("legitimate" or "fraud" or "unknown"))
        {
            return Problem(400, "label_invalid", "label must be legitimate|fraud|unknown");
        }

        if (string.IsNullOrWhiteSpace(body.EvidenceRef))
        {
            return Problem(400, "evidence_ref_required", "evidenceRef required for adjudicated feedback");
        }

        var ev = catalog.GetByEventId(eventId);
        if (ev is null || ev.TenantId != tenantId)
        {
            return Problem(404, "event_not_found", "Event not found");
        }

        var key = Key(tenantId!, eventId);
        while (true)
        {
            var current = _state.GetOrAdd(key, _ => DefaultState(eventId, tenantId!));
            var expected = ResolveExpectedRevision(ifMatchHeader, body.IfMatchRevision);
            if (expected is not null && expected != current.Revision)
            {
                return Problem(409, "revision_conflict", $"Expected revision {expected}, current {current.Revision}");
            }

            var next = current with
            {
                Revision = current.Revision + 1,
                AdjudicatedLabel = body.Label,
                LastActor = actor,
                LastReason = body.Reason,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (!_state.TryUpdate(key, next, current))
            {
                continue;
            }

            AppendAudit(new AnnotationAuditEntry(
                eventId,
                tenantId!,
                current.Revision,
                next.Revision,
                actor,
                "feedback",
                body.Reason,
                body.EvidenceRef,
                DateTimeOffset.UtcNow,
                $"adjudicated={body.Label};heuristic_unchanged={current.HeuristicSuspect}"));

            return (200, next);
        }
    }

    public IReadOnlyList<AnnotationAuditEntry> GetAudit(string eventId, string tenantId) =>
        _audit.TryGetValue(Key(tenantId, eventId), out var list) ? list : [];

    private void AppendAudit(AnnotationAuditEntry entry)
    {
        var key = Key(entry.TenantId, entry.EventId);
        _audit.AddOrUpdate(
            key,
            _ => ImmutableList.Create(entry),
            (_, prev) => prev.Add(entry));
    }

    private static EventAnnotationState DefaultState(string eventId, string tenantId) =>
        new(eventId, tenantId, 1, null, "unknown", "none", [], null, null, null);

    private static string Key(string tenantId, string eventId) => $"{tenantId}:{eventId}";

    private static long? ResolveExpectedRevision(string? ifMatchHeader, long? bodyRevision)
    {
        if (bodyRevision is not null)
        {
            return bodyRevision;
        }

        if (string.IsNullOrWhiteSpace(ifMatchHeader))
        {
            return null;
        }

        var raw = ifMatchHeader.Trim().Trim('"');
        if (raw.StartsWith("W/", StringComparison.Ordinal))
        {
            raw = raw[2..].Trim().Trim('"');
        }

        return long.TryParse(raw, out var rev) ? rev : -1; // -1 forces conflict on bad etag
    }

    private static bool Auth(string? apiKeyKind, out (int, object) problem)
    {
        if (string.IsNullOrWhiteSpace(apiKeyKind))
        {
            problem = Problem(401, "unauthorized", "Server API key required");
            return false;
        }

        if (!string.Equals(apiKeyKind, "server", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(apiKeyKind, "secret", StringComparison.OrdinalIgnoreCase))
        {
            problem = Problem(403, "forbidden", "Client keys cannot annotate events");
            return false;
        }

        problem = default;
        return true;
    }

    private static bool RequireTenant(string? tenantId, out (int, object) problem)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            problem = Problem(400, "tenant_required", "X-Tenant-Id required");
            return false;
        }

        problem = default;
        return true;
    }

    private static (int, object) Problem(int status, string code, string detail) =>
        (status, new IdentifyProblem
        {
            Type = $"https://night-watch.local/problems/{code}",
            Title = code,
            Status = status,
            Code = code,
            Detail = detail
        });
}
