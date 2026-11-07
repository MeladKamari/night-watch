using System.Text.Json;
using Grpc.Core;
using NightWatch.Api.Grpc.V1;
using NightWatch.BuildingBlocks;
using NightWatch.Modules.Identity;
using NightWatch.Modules.Risk.Behavior;
using NightWatch.Modules.Risk.Reputation;
using NightWatch.Modules.Risk.SmartSignals;
using NightWatch.Modules.Risk.SuspectScore;
using IdentifyDomainRequest = NightWatch.Modules.Identity.IdentifyRequest;
using IdentifyDomainProblem = NightWatch.Modules.Identity.IdentifyProblem;
using IdentifyDomainResponse = NightWatch.Modules.Identity.IdentifyResponse;

namespace NightWatch.Api.Grpc;

public sealed class NightWatchIdentityGrpcService(
    IIdentifyChallengeService challenges,
    IIdentifyService identify,
    ISealedResultEnvelopeService sealedEnv,
    EventVelocityCounter velocity,
    UnifiedSignalRegistry signals,
    SuspectScoreEngine scores,
    AsnReputationStore asnStore) : NightWatchIdentity.NightWatchIdentityBase
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public override Task<HealthReply> Health(HealthRequest request, ServerCallContext context) =>
        Task.FromResult(new HealthReply
        {
            Status = "live",
            Product = ProductIdentity.ProductCode,
            Utc = DateTime.UtcNow.ToString("O")
        });

    public override Task<MetaReply> GetMeta(MetaRequest request, ServerCallContext context)
    {
        var reply = new MetaReply
        {
            Product = ProductIdentity.ProductName,
            ProductCode = ProductIdentity.ProductCode,
            IdentityAlgorithmVersion = ProductIdentity.IdentityAlgorithmVersion,
            ProcessingVersion = ProductIdentity.ProcessingVersion,
            LegacySourceManifestRevision = ProductIdentity.LegacySourceManifestRevision,
            HashingRevision = ProductIdentity.HashingRevision,
            RuntimeVendorSaas = false
        };
        reply.Transports.Add("http");
        reply.Transports.Add("grpc");
        return Task.FromResult(reply);
    }

    public override Task<ChallengeReply> Challenge(ChallengeRequest request, ServerCallContext context)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId) || string.IsNullOrWhiteSpace(request.ProjectId))
        {
            throw RpcProblem(StatusCode.InvalidArgument, "namespace_required", "tenantId and projectId required");
        }

        var ticket = challenges.Issue(request.TenantId, request.ProjectId);
        return Task.FromResult(new ChallengeReply
        {
            ChallengeNonce = ticket.ChallengeNonce,
            TenantId = ticket.TenantId,
            ProjectId = ticket.ProjectId,
            ExpiresAt = ticket.ExpiresAt.ToString("O"),
            TtlSeconds = ticket.TtlSeconds,
            Note = "single_use_anti_replay_not_proof_of_honest_collection"
        });
    }

    public override async Task<IdentifyReply> Identify(V1.IdentifyRequest request, ServerCallContext context)
    {
        IdentifyDomainRequest body;
        try
        {
            body = MapIdentifyRequest(request);
        }
        catch (Exception ex)
        {
            throw RpcProblem(StatusCode.InvalidArgument, "invalid_request", ex.Message);
        }

        var (status, payload) = await identify.IdentifyAsync(
            body,
            "application/json",
            string.IsNullOrWhiteSpace(request.IdempotencyKey) ? null : request.IdempotencyKey,
            string.IsNullOrWhiteSpace(request.CorrelationId) ? null : request.CorrelationId);

        if (payload is IdentifyDomainProblem problem)
        {
            throw RpcProblem(MapHttpToGrpc(status), problem.Code, problem.Detail ?? problem.Title);
        }

        if (payload is not IdentifyDomainResponse id)
        {
            throw RpcProblem(StatusCode.Internal, "identify_failed", "unexpected identify payload");
        }

        var audience = string.IsNullOrWhiteSpace(request.SealAudience) ? "customer-backend" : request.SealAudience.Trim();
        var tenantId = body.TenantId!;
        var clientIp = string.IsNullOrWhiteSpace(request.ClientIp) ? "unknown" : request.ClientIp.Trim();
        var eventsHour = velocity.Record($"{tenantId}|ip|{clientIp}");
        var anomaly = eventsHour >= 40 ? "elevated_velocity"
            : eventsHour >= 15 ? "elevated_velocity_soft"
            : "none";

        string? smartSignalsJson = null;
        string? scoreReceiptJson = null;
        var enrichmentStatus = id.EnrichmentStatus;

        if (!string.IsNullOrWhiteSpace(request.EnvironmentProbesJson))
        {
            try
            {
                using var probeDoc = JsonDocument.Parse(request.EnvironmentProbesJson);
                var root = WrapProbesRoot(probeDoc.RootElement, body);
                var input = EnvironmentProbeMapper.FromJson(root, signatureAgent: null);
                input = input with { EventsLastHour = input.EventsLastHour ?? eventsHour };
                var netCtx = new NetworkLookupContext(ForwardedFor: null, ClientIp: clientIp, ClientAsn: null);
                input = NetworkReputationEnricher.Enrich(input, netCtx, asnStore);
                var outcomes = signals.EvaluateAllWeb(input, "identify-grpc:" + id.EventId);
                var scored = scores.Score(tenantId, outcomes);
                enrichmentStatus = "completed";
                smartSignalsJson = JsonSerializer.Serialize(outcomes.Select(o => new
                {
                    signalId = o.SignalId,
                    status = o.Status,
                    triState = o.TriState.ToString(),
                    value = o.Value,
                    confidence = o.Confidence,
                    evidence = o.Evidence
                }), JsonOpts);
                scoreReceiptJson = JsonSerializer.Serialize(new
                {
                    score = scored.Score,
                    decision = scored.Decision,
                    mode = scored.Mode,
                    version = scored.Version,
                    eventsLastHour = eventsHour,
                    anomaly,
                    receipt = "heuristic_weighted_not_calibrated_ml"
                }, JsonOpts);
            }
            catch (JsonException)
            {
                // probes optional
            }
        }

        scoreReceiptJson ??= JsonSerializer.Serialize(new
        {
            score = eventsHour >= 40 ? 60 : eventsHour >= 15 ? 25 : 0,
            decision = eventsHour >= 40 ? "challenge" : "observe",
            mode = "velocity_only",
            eventsLastHour = eventsHour,
            anomaly,
            receipt = "heuristic_velocity_not_calibrated_ml"
        }, JsonOpts);

        var envelope = sealedEnv.Seal(new SealRequest(
            audience,
            id.EventId,
            tenantId,
            new
            {
                visitorId = id.VisitorId,
                eventId = id.EventId,
                matchType = id.MatchType,
                receipt = id.Receipt,
                confidenceStatus = id.ConfidenceStatus,
                continuityId = id.Continuity?.ContinuityId
            }));

        var reply = new IdentifyReply
        {
            VisitorId = id.VisitorId,
            EventId = id.EventId,
            MatchType = id.MatchType,
            FirstSeenAt = id.FirstSeenAt,
            LastSeenAt = id.LastSeenAt,
            ConfidenceStatus = id.ConfidenceStatus,
            ConfidenceNote = id.ConfidenceNote ?? "",
            EnrichmentStatus = enrichmentStatus,
            Receipt = id.Receipt,
            ReceiptExpiresAt = id.ReceiptExpiresAt,
            IdentityAlgorithmVersion = id.IdentityAlgorithmVersion,
            ProcessingVersion = id.ProcessingVersion,
            Namespace = id.Namespace,
            Duplicate = id.Duplicate,
            CorrelationId = id.CorrelationId,
            SealedEnvelope = envelope,
            SealedAudience = audience,
            SealedNote = "client_visible_only_not_authoritative_without_unseal",
            ScoreReceiptJson = scoreReceiptJson,
            SmartSignalsJson = smartSignalsJson ?? "",
            Velocity = new VelocityInfo
            {
                EventsLastHour = eventsHour,
                Anomaly = anomaly,
                KeyKind = "tenant_ip",
                Note = "heuristic_velocity_not_calibrated_ml"
            }
        };

        if (id.Confidence is { } conf)
        {
            reply.Confidence = conf;
            reply.ConfidenceSpecified = true;
        }

        if (id.Continuity is { } c)
        {
            reply.Continuity = new V1.ContinuityInfo
            {
                Status = c.Status,
                ContinuityId = c.ContinuityId ?? "",
                Token = c.Token ?? "",
                CookieName = c.CookieName ?? "",
                Claim = c.Claim,
                Code = c.Code ?? ""
            };
        }

        if (id.MatchInsights is { } mi)
        {
            reply.MatchInsights = new V1.MatchInsights
            {
                Status = mi.Status,
                BestCandidateVisitorId = mi.BestCandidateVisitorId ?? "",
                BestScore = mi.BestScore ?? 0,
                BestDecision = mi.BestDecision ?? "",
                SoftLinked = mi.SoftLinked,
                Note = mi.Note
            };
            foreach (var cand in mi.TopCandidates)
            {
                var mc = new MatchCandidate
                {
                    VisitorId = cand.VisitorId,
                    Score = cand.Score,
                    Decision = cand.Decision
                };
                mc.AgreeingFeatures.AddRange(cand.AgreeingFeatures);
                reply.MatchInsights.TopCandidates.Add(mc);
            }
        }

        return reply;
    }

    public override Task<UnsealReply> Unseal(UnsealRequest request, ServerCallContext context)
    {
        if (string.IsNullOrWhiteSpace(request.Envelope))
        {
            throw RpcProblem(StatusCode.InvalidArgument, "envelope_required", "envelope required");
        }

        var audience = string.IsNullOrWhiteSpace(request.Audience) ? "customer-backend" : request.Audience.Trim();
        var consumeOnce = !request.SkipConsume;
        var result = sealedEnv.Unseal(request.Envelope, audience, consumeOnce);
        return Task.FromResult(new UnsealReply
        {
            Ok = result.Ok,
            Code = result.Code ?? "",
            EventId = result.EventId ?? "",
            Audience = result.Audience ?? audience,
            PayloadJson = result.Payload is JsonElement p ? p.GetRawText() : ""
        });
    }

    public override Task<HashComponentsReply> HashComponents(HashComponentsRequest request, ServerCallContext context)
    {
        try
        {
            var (visitorId, canonical) = ComponentProtoMapper.Hash(request.Components, request.ComponentsJson);
            return Task.FromResult(new HashComponentsReply
            {
                VisitorId = visitorId,
                Canonical = canonical,
                HashingRevision = ProductIdentity.HashingRevision,
                Note = "lab_helper_parity_with_hashComponents_not_a_trust_proof"
            });
        }
        catch (Exception ex)
        {
            throw RpcProblem(StatusCode.InvalidArgument, "components_invalid", ex.Message);
        }
    }

    private static IdentifyDomainRequest MapIdentifyRequest(V1.IdentifyRequest request)
    {
        var legacy = request.LegacyBrowser
            ?? throw new InvalidOperationException("legacy_browser required");

        var components = ComponentProtoMapper.ToJsonElement(legacy.Components, legacy.ComponentsJson);
        var keys = legacy.ComponentKeys.Count > 0
            ? legacy.ComponentKeys.ToList()
            : components.EnumerateObject().Select(p => p.Name).ToList();

        ClientDeviceContext? device = null;
        if (request.ClientDevice is { } d)
        {
            device = new ClientDeviceContext
            {
                Platform = EmptyToNull(d.Platform),
                OsFamily = EmptyToNull(d.OsFamily),
                BrowserFamily = EmptyToNull(d.BrowserFamily),
                Locale = EmptyToNull(d.Locale),
                ScreenWidth = d.ScreenWidth == 0 ? null : d.ScreenWidth,
                ScreenHeight = d.ScreenHeight == 0 ? null : d.ScreenHeight,
                WebGlRenderer = EmptyToNull(d.WebglRenderer)
            };
        }

        return new IdentifyDomainRequest
        {
            SchemaVersion = string.IsNullOrWhiteSpace(request.SchemaVersion)
                ? "night-watch-identify-v1"
                : request.SchemaVersion,
            ProductCode = string.IsNullOrWhiteSpace(request.ProductCode)
                ? ProductIdentity.ProductCode
                : request.ProductCode,
            Purpose = request.Purpose,
            ConsentStatus = string.IsNullOrWhiteSpace(request.ConsentStatus) ? "granted" : request.ConsentStatus,
            CollectedAt = string.IsNullOrWhiteSpace(request.CollectedAt)
                ? DateTimeOffset.UtcNow.ToString("O")
                : request.CollectedAt,
            IdempotencyKey = request.IdempotencyKey,
            TenantId = request.TenantId,
            ProjectId = request.ProjectId,
            Region = EmptyToNull(request.Region),
            ChallengeNonce = request.ChallengeNonce,
            ContinuityToken = EmptyToNull(request.ContinuityToken),
            ContinuityLegalBasis = string.IsNullOrWhiteSpace(request.ContinuityLegalBasis)
                ? "legitimate_interest"
                : request.ContinuityLegalBasis,
            ClientVisitorId = EmptyToNull(request.ClientVisitorId),
            ClientConfidence = request.ClientConfidence == 0 ? null : request.ClientConfidence,
            ClientDevice = device,
            LegacyBrowser = new LegacyIdentifyBrowser
            {
                VisitorId = legacy.VisitorId,
                SourceManifestRevision = string.IsNullOrWhiteSpace(legacy.SourceManifestRevision)
                    ? ProductIdentity.LegacySourceManifestRevision
                    : legacy.SourceManifestRevision,
                HashingRevision = string.IsNullOrWhiteSpace(legacy.HashingRevision)
                    ? ProductIdentity.HashingRevision
                    : legacy.HashingRevision,
                ComponentKeys = keys,
                Components = components
            }
        };
    }

    private static JsonElement WrapProbesRoot(JsonElement probes, IdentifyDomainRequest body)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WritePropertyName("environmentProbes");
            probes.WriteTo(writer);
            writer.WriteString("tenantId", body.TenantId);
            writer.WriteString("projectId", body.ProjectId);
            writer.WriteEndObject();
        }

        return JsonDocument.Parse(stream.ToArray()).RootElement.Clone();
    }

    private static string? EmptyToNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

    private static StatusCode MapHttpToGrpc(int status) => status switch
    {
        400 => StatusCode.InvalidArgument,
        409 => StatusCode.AlreadyExists,
        415 => StatusCode.InvalidArgument,
        403 => StatusCode.PermissionDenied,
        404 => StatusCode.NotFound,
        401 => StatusCode.Unauthenticated,
        _ => StatusCode.Internal
    };

    private static RpcException RpcProblem(StatusCode code, string problemCode, string detail) =>
        new(new Status(code, $"{problemCode}: {detail}"),
            new Metadata { { "nightwatch-error-code", problemCode } });
}
