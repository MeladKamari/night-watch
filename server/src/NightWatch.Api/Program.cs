using System.Text.Json;
using NightWatch.BuildingBlocks;
using NightWatch.BuildingBlocks.Caching;
using NightWatch.BuildingBlocks.Configuration;
using NightWatch.BuildingBlocks.Edge;
using NightWatch.Persistence;
using NightWatch.Modules.Admin;
using NightWatch.Modules.Identity;
using NightWatch.Modules.Identity.Matching;
using IdentifyRequest = NightWatch.Modules.Identity.IdentifyRequest;
using IdentifyProblem = NightWatch.Modules.Identity.IdentifyProblem;
using NightWatch.Modules.Ingestion;
using ObservationIngestRequest = NightWatch.Modules.Ingestion.ObservationIngestRequest;
using ProblemDetailsBody = NightWatch.Modules.Ingestion.ProblemDetailsBody;
using NightWatch.Modules.Intelligence;
using NightWatch.Modules.Privacy;
using NightWatch.Modules.Reporting;
using NightWatch.Modules.Risk;
using NightWatch.Modules.Risk.Behavior;
using NightWatch.Modules.Risk.Bots;
using NightWatch.Modules.Risk.Feedback;
using NightWatch.Modules.Risk.Decisions;
using NightWatch.Modules.Risk.Investigation;
using NightWatch.Modules.Risk.Rules;
using NightWatch.Modules.Risk.Reputation;
using NightWatch.Modules.Risk.SmartSignals;
using NightWatch.Modules.Risk.SuspectScore;
using NightWatch.Modules.Webhooks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(o =>
{
    o.IncludeScopes = true;
    o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});

builder.Services.AddOpenApi();
builder.Services.AddCors(o => o.AddPolicy("console", p =>
    p.WithOrigins(
            "http://127.0.0.1:4300",
            "http://localhost:4300",
            "http://127.0.0.1:4173",
            "http://localhost:4173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));
builder.Services.AddProPlusOptions();
builder.Services.AddProPlusCaching(builder.Configuration);
builder.Services.AddProPlusEdgeAdapter();
builder.Services.AddSingleton<NightWatch.BuildingBlocks.Filtering.INetworkFilterEngine, NightWatch.BuildingBlocks.Filtering.NetworkFilterEngine>();
builder.Services.AddProPlusPersistence(
    builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration["NightWatch:Storage:ConnectionString"]);
builder.Services.AddIngestionModule();
builder.Services.AddIdentityModule();
builder.Services.AddIntelligenceModule();
builder.Services.AddRiskModule();
builder.Services.AddAdminModule();
builder.Services.AddSingleton<IAdminAuditSink, EfAdminAuditSink>();
builder.Services.AddSingleton<EfAdminDurableState>();
builder.Services.AddSingleton<IApiCredentialDurableSink>(sp => sp.GetRequiredService<EfAdminDurableState>());
builder.Services.AddSingleton<IWebhookDurableSink>(sp => sp.GetRequiredService<EfAdminDurableState>());
builder.Services.AddSingleton<IManagementProjectDurableSink>(sp => sp.GetRequiredService<EfAdminDurableState>());
builder.Services.AddSingleton<EfDeviceVectorDurableState>();
builder.Services.AddSingleton<IDeviceVectorDurableSink>(sp => sp.GetRequiredService<EfDeviceVectorDurableState>());
builder.Services.AddSingleton<EfVisitorAliasDurableState>();
builder.Services.AddSingleton<IVisitorAliasDurableSink>(sp => sp.GetRequiredService<EfVisitorAliasDurableState>());
builder.Services.AddSingleton<IHoldoutConfidenceSource, FeedbackHoldoutConfidenceSource>();
builder.Services.Configure<ConsoleMfaOptions>(builder.Configuration.GetSection("NightWatch:ConsoleMfa"));
builder.Services.AddSingleton(sp =>
{
    var o = new ConsoleMfaOptions();
    builder.Configuration.GetSection("NightWatch:ConsoleMfa").Bind(o);
    if (string.Equals(Environment.GetEnvironmentVariable("NIGHT_WATCH_CONSOLE_MFA"), "1", StringComparison.Ordinal))
    {
        o.Enabled = true;
    }

    return o;
});
builder.Services.Configure<ConsoleOidcOptions>(builder.Configuration.GetSection("NightWatch:ConsoleOidc"));
builder.Services.AddSingleton(sp =>
{
    var o = new ConsoleOidcOptions();
    builder.Configuration.GetSection("NightWatch:ConsoleOidc").Bind(o);
    return o;
});
builder.Services.AddWebhooksModule();
builder.Services.AddPrivacyModule();
builder.Services.AddReportingModule();

builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy("process_up"), tags: ["live"])
    .AddCheck<ReadinessHealthCheck>("readiness", tags: ["ready"]);

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(ProductIdentity.ProductCode))
    .WithTracing(t => t.AddAspNetCoreInstrumentation());

var app = builder.Build();

// Offline lab ASN/VPN/Tor reputation — no runtime SaaS fetch.
{
    var asnStore = app.Services.GetRequiredService<AsnReputationStore>();
    var feedKey = builder.Configuration["NightWatch:Reputation:SigningKey"]
                  ?? "night-watch-dev-feed-signing-key";
    _ = NetworkReputationBootstrap.SeedAll(asnStore, feedKey, DateTimeOffset.UtcNow);
}

try
{
    var durable = app.Services.GetRequiredService<EfAdminDurableState>();
    durable.EnsureSchemaAndHydrate(
        app.Services.GetRequiredService<IApiCredentialService>() as ApiCredentialService
            ?? throw new InvalidOperationException("IApiCredentialService must be ApiCredentialService"),
        app.Services.GetRequiredService<IWebhookOutboundService>() as WebhookOutboundService
            ?? throw new InvalidOperationException("IWebhookOutboundService must be WebhookOutboundService"),
        app.Services.GetRequiredService<IManagementApiService>() as ManagementApiService
            ?? throw new InvalidOperationException("IManagementApiService must be ManagementApiService"));
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "management_durable_hydrate_skipped");
}

try
{
    var vectorsDurable = app.Services.GetRequiredService<EfDeviceVectorDurableState>();
    vectorsDurable.EnsureSchemaAndHydrate(
        app.Services.GetRequiredService<IDeviceVectorStore>(),
        app.Services.GetRequiredService<ICandidateRetrievalService>());
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "device_vector_hydrate_skipped");
}

try
{
    app.Services.GetRequiredService<EfVisitorAliasDurableState>()
        .EnsureSchemaAndHydrate(app.Services.GetRequiredService<IVisitorAliasStore>());
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "visitor_alias_hydrate_skipped");
}

app.Lifetime.ApplicationStarted.Register(() =>
    app.Logger.LogInformation("{Product} API started (no vendor SaaS runtime dependency)", ProductIdentity.ProductName));
app.Lifetime.ApplicationStopping.Register(() =>
    app.Logger.LogInformation("{Product} API stopping gracefully", ProductIdentity.ProductName));

app.UseCors("console");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health/live", () => Results.Json(new
{
    status = "live",
    product = ProductIdentity.ProductCode,
    utc = DateTime.UtcNow
})).WithName("Liveness");

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("ready"),
    ResponseWriter = WriteReadyResponseAsync
}).WithName("Readiness");

app.MapGet("/v1/meta", (IEnumerable<IProPlusModule> modules) =>
{
    var names = modules.Select(m => m.Name).OrderBy(n => n).ToArray();
    return Results.Json(new
    {
        product = ProductIdentity.ProductName,
        productCode = ProductIdentity.ProductCode,
        identityAlgorithmVersion = ProductIdentity.IdentityAlgorithmVersion,
        processingVersion = ProductIdentity.ProcessingVersion,
        legacySourceManifestRevision = ProductIdentity.LegacySourceManifestRevision,
        modules = names,
        runtimeVendorSaas = false,
        applePay = "excluded"
    });
}).WithName("Meta");

app.MapGet("/v1/management/health", (IEnumerable<IProPlusModule> modules) =>
{
    var names = modules.Select(m => m.Name).OrderBy(n => n).ToArray();
    return Results.Json(new
    {
        productLabel = "Night Watch (independent)",
        apiStatus = "known",
        message = "management_ok",
        modules = names
    });
}).WithName("ManagementHealth");

app.MapPost("/v1/observations", async (HttpRequest request, IObservationIngestService ingest) =>
{
    var contentType = request.ContentType ?? "";
    var media = contentType.Split(';')[0].Trim().ToLowerInvariant();
    if (media is not ("application/json" or "application/*+json"))
    {
        return Results.Json(
            new ProblemDetailsBody
            {
                Type = "https://night-watch.local/problems/unsupported_media_type",
                Title = "unsupported_media_type",
                Status = 415,
                Code = "unsupported_media_type",
                Detail = "Content-Type must be application/json"
            },
            statusCode: 415,
            contentType: "application/problem+json");
    }

    if (request.ContentLength is > 0 and var len && len > 64 * 1024)
    {
        return Results.Json(
            new ProblemDetailsBody
            {
                Type = "https://night-watch.local/problems/payload_too_large",
                Title = "payload_too_large",
                Status = 413,
                Code = "payload_too_large",
                Detail = "Payload exceeds maximum size"
            },
            statusCode: 413,
            contentType: "application/problem+json");
    }

    ObservationIngestRequest? body;
    try
    {
        body = await request.ReadFromJsonAsync<ObservationIngestRequest>();
    }
    catch (Exception)
    {
        return Results.Json(
            new ProblemDetailsBody
            {
                Type = "https://night-watch.local/problems/invalid_json",
                Title = "invalid_json",
                Status = 400,
                Code = "invalid_json",
                Detail = "Malformed JSON"
            },
            statusCode: 400,
            contentType: "application/problem+json");
    }

    request.Headers.TryGetValue("Idempotency-Key", out var idemHeader);
    request.Headers.TryGetValue("X-Correlation-Id", out var corrHeader);
    var origin = request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(origin))
    {
        origin = null;
    }

    var (status, payload) = await ingest.IngestAsync(
        body,
        request.ContentType,
        request.ContentLength,
        origin,
        string.IsNullOrWhiteSpace(idemHeader.ToString()) ? null : idemHeader.ToString(),
        string.IsNullOrWhiteSpace(corrHeader.ToString()) ? null : corrHeader.ToString());

    if (payload is ProblemDetailsBody)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("IngestObservation");

app.MapPost("/v1/identify", async (
    HttpRequest request,
    IIdentifyService identify,
    ISealedResultEnvelopeService sealedEnv,
    UnifiedSignalRegistry signals,
    SuspectScoreEngine scores,
    AsnReputationStore asnStore,
    FirstPartyCookieOptions cookieOptions,
    EventVelocityCounter velocity,
    LocalDevicePopulationStore population) =>
{
    IdentifyRequest? body;
    JsonElement? rawRoot = null;
    try
    {
        using var doc = await JsonDocument.ParseAsync(request.Body);
        rawRoot = doc.RootElement.Clone();
        body = doc.RootElement.Deserialize<IdentifyRequest>(CreateIdentifyJsonOptions());
    }
    catch (Exception)
    {
        return Results.Json(
            new IdentifyProblem
            {
                Type = "https://night-watch.local/problems/invalid_json",
                Title = "invalid_json",
                Status = 400,
                Code = "invalid_json",
                Detail = "Malformed JSON"
            },
            statusCode: 400,
            contentType: "application/problem+json");
    }

    request.Headers.TryGetValue("Idempotency-Key", out var idemHeader);
    request.Headers.TryGetValue("X-Correlation-Id", out var corrHeader);
    request.Headers.TryGetValue("X-Seal-Audience", out var sealAudience);
    request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader);

    // Prefer body token; fall back to first-party continuity cookie (same-site deployments).
    if (body is not null && string.IsNullOrWhiteSpace(body.ContinuityToken))
    {
        if (request.Cookies.TryGetValue(cookieOptions.CookieName, out var cookieVal) && !string.IsNullOrWhiteSpace(cookieVal))
        {
            body.ContinuityToken = cookieVal;
        }
        else if (request.Headers.TryGetValue("X-Continuity-Token", out var contHdr)
                 && !string.IsNullOrWhiteSpace(contHdr))
        {
            body.ContinuityToken = contHdr.ToString();
        }
    }

    var (status, payload) = await identify.IdentifyAsync(
        body,
        request.ContentType,
        string.IsNullOrWhiteSpace(idemHeader.ToString()) ? null : idemHeader.ToString(),
        string.IsNullOrWhiteSpace(corrHeader.ToString()) ? null : corrHeader.ToString());

    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    if (payload is IdentifyResponse id)
    {
        var audience = string.IsNullOrWhiteSpace(sealAudience.ToString()) ? "customer-backend" : sealAudience.ToString();
        var tenantId = string.IsNullOrWhiteSpace(tenantHeader.ToString())
            ? (body?.TenantId ?? "tenant_demo")
            : tenantHeader.ToString();

        object? smartSignals = null;
        object? scoreReceipt = null;
        var enrichmentStatus = id.EnrichmentStatus;
        if (rawRoot is { } root)
        {
            var netCtx = ReadNetworkContext(request);
            var velKey = $"{tenantId}|ip|{(netCtx.ClientIp ?? netCtx.ForwardedFor ?? "unknown")}";
            var eventsHour = velocity.Record(velKey);
            var input = EnvironmentProbeMapper.FromJson(root, ReadSignatureAgent(request));
            input = input with { EventsLastHour = input.EventsLastHour ?? eventsHour };
            input = NetworkReputationEnricher.Enrich(input, netCtx, asnStore);
            input = ApplyPopulationAndEdgeSignals(input, request, tenantId, population);
            var hasObservedProbes = input.ProbeCollected || !string.IsNullOrWhiteSpace(input.UserAgent)
                || input.WebDriver is not null || (input.AutomationArtifacts?.Count ?? 0) > 0
                || input.VpnHints is not null || input.ProxyHints is not null
                || input.BlocklistHit is not null || !string.IsNullOrWhiteSpace(input.GeoRegion)
                || input.ProximityConsent == true;
            if (hasObservedProbes)
            {
                var outcomes = signals.EvaluateAllWeb(input, "identify:" + id.EventId);
                var scored = scores.Score(tenantId, outcomes);
                enrichmentStatus = "completed";
                smartSignals = outcomes.Select(o => new
                {
                    signalId = o.SignalId,
                    status = o.Status,
                    triState = o.TriState.ToString(),
                    value = o.Value,
                    confidence = o.Confidence,
                    evidence = o.Evidence
                });
                scoreReceipt = new
                {
                    score = scored.Score,
                    decision = scored.Decision,
                    mode = scored.Mode,
                    version = scored.Version,
                    scoreKind = scored.ScoreKind,
                    facets = scored.Facets,
                    unknownSignals = scored.UnknownSignals,
                    reasonCodes = scored.ReasonCodes,
                    eventsLastHour = eventsHour,
                    receipt = "heuristic_weighted_not_calibrated_ml"
                };
            }
        }

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

        if (id.Continuity?.Token is { Length: > 0 } token
            && id.Continuity.CookieName is { Length: > 0 } cookieName)
        {
            // Secure+__Host- cookies need HTTPS; lab HTTP still returns token in JSON for SPA storage.
            if (request.IsHttps)
            {
                request.HttpContext.Response.Cookies.Append(
                    cookieName,
                    token,
                    new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.Lax,
                        Path = "/",
                        MaxAge = TimeSpan.FromDays(30)
                    });
            }
        }

        return Results.Json(new
        {
            id.VisitorId,
            id.EventId,
            id.MatchType,
            id.FirstSeenAt,
            id.LastSeenAt,
            id.Confidence,
            id.ConfidenceStatus,
            id.ConfidenceNote,
            enrichmentStatus,
            id.Receipt,
            id.ReceiptExpiresAt,
            id.IdentityAlgorithmVersion,
            id.ProcessingVersion,
            id.Namespace,
            id.Duplicate,
            id.CorrelationId,
            matchInsights = id.MatchInsights,
            continuity = id.Continuity is null ? null : new
            {
                status = id.Continuity.Status,
                continuityId = id.Continuity.ContinuityId,
                token = id.Continuity.Token,
                cookieName = id.Continuity.CookieName,
                claim = id.Continuity.Claim,
                code = id.Continuity.Code
            },
            smartSignals,
            scoreReceipt,
            sealedEnvelope = envelope,
            sealedAudience = audience,
            sealedNote = "client_visible_only_not_authoritative_without_unseal"
        }, statusCode: status);
    }

    return Results.Json(payload, statusCode: status);
}).WithName("Identify");

app.MapPost("/v1/sealed/unseal", async (HttpRequest request, ISealedResultEnvelopeService sealedEnv) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var envelope = doc.RootElement.TryGetProperty("envelope", out var e) ? e.GetString() ?? "" : "";
    var audience = doc.RootElement.TryGetProperty("audience", out var a) ? a.GetString() ?? "customer-backend" : "customer-backend";
    var consume = !doc.RootElement.TryGetProperty("consumeOnce", out var c) || c.ValueKind != JsonValueKind.False;
    var result = sealedEnv.Unseal(envelope, audience, consume);
    if (!result.Ok)
    {
        return Results.Json(new { code = result.Code ?? "unseal_failed", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    return Results.Json(new
    {
        ok = true,
        eventId = result.EventId,
        audience = result.Audience,
        payload = result.Payload
    });
}).WithName("UnsealResult");

app.MapGet("/v1/events", (HttpRequest request, IEventSearchService search) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    request.Headers.TryGetValue("X-Api-Scope", out var scope);
    request.Headers.TryGetValue("X-Actor-Id", out var actor);
    int? limit = int.TryParse(request.Query["limit"].ToString(), out var l) ? l : null;
    var (status, payload) = search.Search(
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(scope.ToString()) ? null : scope.ToString(),
        request.Query["eventId"].ToString(),
        request.Query["visitorId"].ToString(),
        request.Query["linkedId"].ToString(),
        request.Query["from"].ToString(),
        request.Query["to"].ToString(),
        request.Query["suspect"].ToString(),
        request.Query["riskBand"].ToString(),
        request.Query["source"].ToString(),
        request.Query["networkAsn"].ToString(),
        request.Query["signalStatus"].ToString(),
        request.Query["cursor"].ToString(),
        limit,
        string.IsNullOrWhiteSpace(actor.ToString()) ? null : actor.ToString());
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("SearchEvents");

app.MapGet("/v1/events/{eventId}", (string eventId, HttpRequest request, IEventQueryService events) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    var (status, payload) = events.GetEvent(
        eventId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString());
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("GetEvent");

app.MapGet("/v1/visitors/{visitorId}/events", (string visitorId, HttpRequest request, IEventQueryService events) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    var cursor = request.Query["cursor"].ToString();
    var limitRaw = request.Query["limit"].ToString();
    int? limit = int.TryParse(limitRaw, out var l) ? l : null;
    var (status, payload) = events.GetVisitorEvents(
        visitorId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(cursor) ? null : cursor,
        limit);
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("GetVisitorEvents");

app.MapPatch("/v1/events/{eventId}", async (string eventId, HttpRequest request, IEventAnnotationService annotations) =>
{
    PatchEventAnnotationRequest? body;
    try
    {
        body = await request.ReadFromJsonAsync<PatchEventAnnotationRequest>();
    }
    catch
    {
        return Results.Json(
            new IdentifyProblem
            {
                Type = "https://night-watch.local/problems/invalid_json",
                Title = "invalid_json",
                Status = 400,
                Code = "invalid_json",
                Detail = "Malformed JSON"
            },
            statusCode: 400,
            contentType: "application/problem+json");
    }

    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    request.Headers.TryGetValue("X-Actor-Id", out var actor);
    request.Headers.TryGetValue("If-Match", out var ifMatch);
    var (status, payload) = annotations.Patch(
        eventId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(actor.ToString()) ? null : actor.ToString(),
        string.IsNullOrWhiteSpace(ifMatch.ToString()) ? null : ifMatch.ToString(),
        body);
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    if (payload is EventAnnotationState st)
    {
        return Results.Json(st, statusCode: status);
    }

    return Results.Json(payload, statusCode: status);
}).WithName("PatchEventAnnotation");

app.MapPost("/v1/events/{eventId}/feedback", async (string eventId, HttpRequest request, IEventAnnotationService annotations) =>
{
    PostEventFeedbackRequest? body;
    try
    {
        body = await request.ReadFromJsonAsync<PostEventFeedbackRequest>();
    }
    catch
    {
        return Results.Json(
            new IdentifyProblem
            {
                Type = "https://night-watch.local/problems/invalid_json",
                Title = "invalid_json",
                Status = 400,
                Code = "invalid_json",
                Detail = "Malformed JSON"
            },
            statusCode: 400,
            contentType: "application/problem+json");
    }

    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    request.Headers.TryGetValue("X-Actor-Id", out var actor);
    request.Headers.TryGetValue("If-Match", out var ifMatch);
    var (status, payload) = annotations.PostFeedback(
        eventId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(actor.ToString()) ? null : actor.ToString(),
        string.IsNullOrWhiteSpace(ifMatch.ToString()) ? null : ifMatch.ToString(),
        body);
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("PostEventFeedback");

app.MapDelete("/v1/visitors/{visitorId}", (string visitorId, HttpRequest request, IVisitorLifecycleService lifecycle) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    request.Headers.TryGetValue("X-Actor-Id", out var actor);
    var reason = request.Query["reason"].ToString();
    var (status, payload) = lifecycle.DeleteVisitor(
        visitorId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(actor.ToString()) ? null : actor.ToString(),
        string.IsNullOrWhiteSpace(reason) ? null : reason);
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("DeleteVisitor");

app.MapGet("/v1/visitors/{visitorId}/privacy-export", (string visitorId, HttpRequest request, IVisitorLifecycleService lifecycle) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenant);
    request.Headers.TryGetValue("X-Api-Key-Kind", out var keyKind);
    request.Headers.TryGetValue("X-Actor-Id", out var actor);
    var (status, payload) = lifecycle.ExportVisitor(
        visitorId,
        string.IsNullOrWhiteSpace(tenant.ToString()) ? null : tenant.ToString(),
        string.IsNullOrWhiteSpace(keyKind.ToString()) ? null : keyKind.ToString(),
        string.IsNullOrWhiteSpace(actor.ToString()) ? null : actor.ToString());
    if (payload is IdentifyProblem)
    {
        return Results.Json(payload, statusCode: status, contentType: "application/problem+json");
    }

    return Results.Json(payload, statusCode: status);
}).WithName("PrivacyExportVisitor");

app.MapPost("/v1/decisions/evaluate", async (
    HttpRequest request,
    DecisionOrchestrator decisions,
    SuspectScoreEngine scores,
    UnifiedSignalRegistry signals,
    AsnReputationStore asnStore,
    EventVelocityCounter velocity,
    LocalDevicePopulationStore population) =>
{
    request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader);
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var root = doc.RootElement;
    var tenantId = tenantHeader.ToString();
    if (string.IsNullOrWhiteSpace(tenantId))
    {
        tenantId = root.TryGetProperty("tenantId", out var t) ? t.GetString() ?? "" : "";
    }

    var businessAction = root.TryGetProperty("businessAction", out var ba) ? ba.GetString() ?? "" : "";
    var eventId = root.TryGetProperty("eventId", out var eid) ? eid.GetString() ?? "" : "";
    var nonce = root.TryGetProperty("nonce", out var n) ? n.GetString() ?? "" : "";
    var clientScore = root.TryGetProperty("suspectScore", out var sc) && sc.TryGetInt32(out var si) ? si : 0;
    string? returnUrl = root.TryGetProperty("challengeReturnUrl", out var ru) ? ru.GetString() : null;
    var ctx = new Dictionary<string, object?>();
    if (root.TryGetProperty("context", out var context) && context.ValueKind == JsonValueKind.Object)
    {
        foreach (var p in context.EnumerateObject())
        {
            ctx[p.Name] = p.Value.ValueKind switch
            {
                JsonValueKind.Number => p.Value.TryGetDouble(out var d) ? d : p.Value.GetRawText(),
                JsonValueKind.String => p.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => p.Value.GetRawText()
            };
        }
    }

    // Observed environment probes only — lab signalHints toggles are ignored (no fake/simulated signals).
    var netCtx = ReadNetworkContext(request);
    var tenantKey = string.IsNullOrWhiteSpace(tenantId) ? "default" : tenantId;
    var velKey = $"{tenantKey}|ip|{(netCtx.ClientIp ?? netCtx.ForwardedFor ?? "unknown")}";
    var eventsHour = velocity.Record(velKey);
    var input = EnvironmentProbeMapper.FromJson(root, ReadSignatureAgent(request));
    input = input with { EventsLastHour = input.EventsLastHour ?? eventsHour };
    input = NetworkReputationEnricher.Enrich(input, netCtx, asnStore);
    input = ApplyPopulationAndEdgeSignals(input, request, tenantKey, population);
    var hasObservedProbes = input.ProbeCollected || !string.IsNullOrWhiteSpace(input.UserAgent)
        || input.WebDriver is not null || (input.AutomationArtifacts?.Count ?? 0) > 0
        || input.VpnHints is not null || input.ProxyHints is not null
        || input.BlocklistHit is not null || !string.IsNullOrWhiteSpace(input.GeoRegion)
        || input.ProximityConsent == true;
    var outcomes = signals.EvaluateAllWeb(input, "decision:" + eventId);
    var scored = scores.Score(string.IsNullOrWhiteSpace(tenantId) ? "default" : tenantId, outcomes);
    var score = hasObservedProbes ? scored.Score : clientScore;

    var resp = decisions.Evaluate(new DecisionEvaluateRequest(tenantId, businessAction, eventId, nonce, score, ctx, returnUrl));
    return Results.Json(new
    {
        auditId = resp.AuditId,
        action = resp.Action,
        reasons = resp.Reasons,
        policyVersion = resp.PolicyVersion,
        expiresAt = resp.ExpiresAt,
        challenge = resp.Challenge,
        defaultObserveOnly = resp.DefaultObserveOnly,
        scoreReceipt = new
        {
            score = scored.Score,
            clientScore,
            usedScore = score,
            serverAuthoritative = hasObservedProbes,
            decision = scored.Decision,
            mode = scored.Mode,
            version = scored.Version,
            scoreKind = scored.ScoreKind,
            facets = scored.Facets,
            contributions = scored.Contributions.Select(c => new
            {
                signalId = c.SignalId,
                weight = c.Weight,
                appliedPoints = c.AppliedPoints,
                triState = c.TriState.ToString(),
                reasonCode = c.ReasonCode
            }),
            unknownSignals = scored.UnknownSignals,
            reasonCodes = scored.ReasonCodes,
            eventsLastHour = eventsHour,
            receipt = "heuristic_weighted_not_calibrated_ml"
        }
    });
}).WithName("EvaluateDecision");

app.MapPost("/v1/decisions/challenge/complete", async (HttpRequest request, DecisionOrchestrator decisions) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var tenantId = doc.RootElement.TryGetProperty("tenantId", out var t) ? t.GetString() ?? "" : "";
    var eventId = doc.RootElement.TryGetProperty("eventId", out var e) ? e.GetString() ?? "" : "";
    var nonce = doc.RootElement.TryGetProperty("nonce", out var n) ? n.GetString() ?? "" : "";
    var challengeId = doc.RootElement.TryGetProperty("challengeId", out var c) ? c.GetString() ?? "" : "";
    var success = doc.RootElement.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
    var resp = decisions.CompleteChallenge(tenantId, eventId, nonce, challengeId, success);
    return Results.Json(resp);
}).WithName("CompleteDecisionChallenge");

// --- Admin console auth + management resources ---
app.MapPost("/v1/console/login", async (HttpRequest request, HttpResponse response, IConsoleAuthService auth, IConsoleMfaService mfa) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var username = doc.RootElement.TryGetProperty("username", out var u) ? u.GetString() ?? "" : "";
    var password = doc.RootElement.TryGetProperty("password", out var p) ? p.GetString() ?? "" : "";
    var skipMfa = doc.RootElement.TryGetProperty("skipMfa", out var sm) && sm.ValueKind == JsonValueKind.True;
    var (status, body) = auth.Login(username, password);
    if (status != 200)
    {
        return Results.Json(body, statusCode: status, contentType: "application/problem+json");
    }

    if (body is ConsoleLoginResponse login)
    {
        // Lab: admin requires MFA unless skipMfa (Playwright/live E2E sets skipMfa=true).
        if (!skipMfa && mfa.IsMfaEnabled(login.Username))
        {
            auth.Logout(login.SessionId);
            var token = mfa.IssueChallenge(login.Username);
            return Results.Json(new ConsoleMfaChallengeResponse(true, token, "totp_lab", DateTimeOffset.UtcNow.AddMinutes(5)));
        }

        response.Cookies.Append(
            ConsoleAuthService.SessionCookieName,
            login.SessionId,
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = false,
                Path = "/",
                MaxAge = TimeSpan.FromHours(8)
            });
    }

    return Results.Json(body, statusCode: 200);
}).WithName("ConsoleLogin");

app.MapPost("/v1/console/mfa/verify", async (HttpRequest request, HttpResponse response, IConsoleMfaService mfa) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var token = doc.RootElement.TryGetProperty("mfaToken", out var t) ? t.GetString() ?? "" : "";
    var code = doc.RootElement.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "";
    var (ok, session, err) = mfa.Verify(token, code);
    if (!ok || session is null)
    {
        return Results.Json(new { code = err ?? "mfa_failed", status = 401 }, statusCode: 401, contentType: "application/problem+json");
    }

    response.Cookies.Append(
        ConsoleAuthService.SessionCookieName,
        session.SessionId,
        new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = false,
            Path = "/",
            MaxAge = TimeSpan.FromHours(8)
        });
    return Results.Json(session);
}).WithName("ConsoleMfaVerify");

app.MapGet("/v1/console/oidc/metadata", (ConsoleOidcOptions oidc) =>
{
    if (!oidc.Enabled || string.IsNullOrWhiteSpace(oidc.Issuer))
    {
        return Results.Json(new
        {
            enabled = false,
            status = "disabled",
            note = "Configure ConsoleOidcOptions (Issuer/ClientId/RedirectUri) for enterprise OIDC; lab uses password+MFA."
        });
    }

    return Results.Json(new
    {
        enabled = true,
        issuer = oidc.Issuer,
        clientId = oidc.ClientId,
        redirectUri = oidc.RedirectUri,
        scopes = oidc.Scopes,
        authorizeUrl = $"{oidc.Issuer!.TrimEnd('/')}/authorize?client_id={Uri.EscapeDataString(oidc.ClientId ?? "")}&redirect_uri={Uri.EscapeDataString(oidc.RedirectUri ?? "")}&response_type=code&scope={Uri.EscapeDataString(oidc.Scopes ?? "openid")}"
    });
}).WithName("ConsoleOidcMetadata");

app.MapPost("/v1/console/logout", (HttpRequest request, IConsoleAuthService auth) =>
{
    var sid = ReadConsoleSessionId(request);
    var (status, body) = auth.Logout(sid);
    return Results.Json(body, statusCode: status);
}).WithName("ConsoleLogout");

app.MapGet("/v1/console/me", (HttpRequest request, IConsoleAuthService auth) =>
{
    var sid = ReadConsoleSessionId(request);
    var (ok, session, code) = auth.ValidateSession(sid);
    if (!ok || session is null)
    {
        return Results.Json(new { code, title = code, status = 401 }, statusCode: 401, contentType: "application/problem+json");
    }

    return Results.Json(new
    {
        session.UserId,
        session.Username,
        session.TenantId,
        role = session.Role.ToString(),
        csrfToken = session.CsrfToken,
        expiresAt = session.ExpiresAt
    });
}).WithName("ConsoleMe");

app.MapGet("/v1/management/keys", (HttpRequest request, IConsoleAuthService auth, IApiCredentialService keys) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var env = request.Query["environmentId"].ToString();
    if (string.IsNullOrWhiteSpace(env)) env = "dev";
    return Results.Json(new { items = keys.List(session!.TenantId, env) });
}).WithName("ListApiKeys");

app.MapPost("/v1/management/keys", async (HttpRequest request, IConsoleAuthService auth, IApiCredentialService keys) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var kindStr = doc.RootElement.TryGetProperty("kind", out var k) ? k.GetString() ?? "Public" : "Public";
    if (!Enum.TryParse<ApiKeyKind>(kindStr, ignoreCase: true, out var kind)) kind = ApiKeyKind.Public;
    var env = doc.RootElement.TryGetProperty("environmentId", out var e) ? e.GetString() ?? "dev" : "dev";
    var defaultScopes = kind == ApiKeyKind.Public ? new[] { "collect:ingest" } : new[] { "events:read" };
    var scopes = doc.RootElement.TryGetProperty("scopes", out var s) && s.ValueKind == JsonValueKind.Array
        ? s.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray()
        : defaultScopes;
    try
    {
        var created = keys.Create(session.TenantId, env, kind, scopes, [], 600, false, session.Username);
        return Results.Json(new
        {
            keyId = created.Record.KeyId,
            kind = created.Record.Kind.ToString(),
            prefix = created.Record.Prefix,
            masked = created.Record.Prefix + "****",
            secretOnce = created.SecretOnce,
            status = created.Record.Revoked ? "revoked" : "active"
        }, statusCode: 201);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { code = ex.Message, status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }
}).WithName("CreateApiKey");

app.MapPost("/v1/management/keys/{keyId}/revoke", (string keyId, HttpRequest request, IConsoleAuthService auth, IApiCredentialService keys) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    if (!keys.Revoke(session.TenantId, keyId, session.Username))
    {
        return Results.Json(new { code = "key_not_found", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    return Results.Json(new { keyId, status = "revoked" });
}).WithName("RevokeApiKey");

app.MapPost("/v1/management/keys/{keyId}/rotate", (string keyId, HttpRequest request, IConsoleAuthService auth, IApiCredentialService keys) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    var rotated = keys.Rotate(session.TenantId, keyId, session.Username);
    if (rotated is null)
    {
        return Results.Json(new { code = "key_not_found", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    return Results.Json(new
    {
        keyId = rotated.Record.KeyId,
        kind = rotated.Record.Kind.ToString(),
        prefix = rotated.Record.Prefix,
        masked = rotated.Record.Prefix + "****",
        secretOnce = rotated.SecretOnce,
        rotatedFrom = keyId,
        status = "active"
    });
}).WithName("RotateApiKey");

app.MapGet("/v1/management/cases", (HttpRequest request, IConsoleAuthService auth, AnalystReviewQueue queue) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var items = queue.List(session!.TenantId).Select(c => new
    {
        caseId = c.CaseId,
        status = c.Status.ToString(),
        assignee = c.Assignee,
        maker = c.Maker,
        highRisk = c.HighRiskIrreversible
    });
    return Results.Json(new { items });
}).WithName("ListFraudCases");

app.MapPost("/v1/management/cases", async (HttpRequest request, IConsoleAuthService auth, AnalystReviewQueue queue) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var highRisk = doc.RootElement.TryGetProperty("highRisk", out var h) && h.ValueKind == JsonValueKind.True;
    var evidence = doc.RootElement.TryGetProperty("evidence", out var ev) && ev.ValueKind == JsonValueKind.Array
        ? ev.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray()
        : ["demo_evidence"];
    var c = queue.Open(session!.TenantId, session.Username, highRisk, evidence);
    return Results.Json(new { caseId = c.CaseId, status = c.Status.ToString(), assignee = c.Assignee }, statusCode: 201);
}).WithName("OpenFraudCase");

app.MapGet("/v1/management/rules", (HttpRequest request, IConsoleAuthService auth, RulesEngine rules) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var doc = rules.GetPolicy(session!.TenantId);
    if (doc is null)
    {
        return Results.Json(new { tenantId = session.TenantId, revision = "none", rules = Array.Empty<object>() });
    }

    return Results.Json(new
    {
        tenantId = doc.TenantId,
        revision = doc.Revision,
        rules = doc.Rules.Select(r => new { r.RuleId, r.Priority, action = r.Action.ToString(), r.DryRun, r.Scope })
    });
}).WithName("GetRules");

app.MapPost("/v1/management/rules/simulate", async (HttpRequest request, IConsoleAuthService auth, RulesEngine rules) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var facts = new Dictionary<string, object?>();
    if (doc.RootElement.TryGetProperty("facts", out var f) && f.ValueKind == JsonValueKind.Object)
    {
        foreach (var p in f.EnumerateObject())
        {
            facts[p.Name] = p.Value.ValueKind switch
            {
                JsonValueKind.Number => p.Value.TryGetDouble(out var d) ? d : p.Value.GetRawText(),
                JsonValueKind.String => p.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => p.Value.GetRawText()
            };
        }
    }

    facts["tenant.id"] = session!.TenantId;
    var decision = rules.Evaluate(session.TenantId, facts, simulate: true);
    return Results.Json(new
    {
        decision.TenantId,
        decision.Revision,
        effectiveAction = decision.EffectiveAction.ToString(),
        simulated = decision.Simulated,
        matches = decision.Matches.Select(m => new { m.RuleId, action = m.Action.ToString(), m.Explanation })
    });
}).WithName("SimulateRules");

app.MapPost("/v1/management/rules", async (HttpRequest request, IConsoleAuthService auth, RulesEngine rules) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var revision = doc.RootElement.TryGetProperty("revision", out var revEl) ? revEl.GetString() ?? "rev_" + DateTimeOffset.UtcNow.ToUnixTimeSeconds() : "rev_" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    var parsedRules = new List<PolicyRule>();
    if (doc.RootElement.TryGetProperty("rules", out var rulesEl) && rulesEl.ValueKind == JsonValueKind.Array)
    {
        foreach (var r in rulesEl.EnumerateArray())
        {
            var ruleId = r.TryGetProperty("ruleId", out var idEl) ? idEl.GetString() ?? "rule" : "rule";
            var priority = r.TryGetProperty("priority", out var pEl) && pEl.TryGetInt32(out var pri) ? pri : 100;
            var actionStr = r.TryGetProperty("action", out var aEl) ? aEl.GetString() ?? "Observe" : "Observe";
            if (!Enum.TryParse<RuleAction>(actionStr, ignoreCase: true, out var action)) action = RuleAction.Observe;
            var dryRun = r.TryGetProperty("dryRun", out var dEl) && dEl.ValueKind == JsonValueKind.True;
            var scope = r.TryGetProperty("scope", out var sEl) ? sEl.GetString() : null;
            RuleExpr whenExpr = new CmpExpr("suspect_score", CompareOp.Gte, 70);
            if (r.TryGetProperty("when", out var when) && when.ValueKind == JsonValueKind.Object)
            {
                var field = when.TryGetProperty("field", out var fEl) ? fEl.GetString() ?? "suspect_score" : "suspect_score";
                var opStr = when.TryGetProperty("op", out var oEl) ? oEl.GetString() ?? "Gte" : "Gte";
                if (!Enum.TryParse<CompareOp>(opStr, ignoreCase: true, out var op)) op = CompareOp.Gte;
                object? value = 70;
                if (when.TryGetProperty("value", out var vEl))
                {
                    value = vEl.ValueKind switch
                    {
                        JsonValueKind.Number => vEl.TryGetDouble(out var d) ? d : vEl.GetRawText(),
                        JsonValueKind.String => vEl.GetString(),
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        _ => vEl.GetRawText()
                    };
                }

                whenExpr = new CmpExpr(field, op, value);
            }

            parsedRules.Add(new PolicyRule(ruleId, priority, whenExpr, action, scope, null, dryRun));
        }
    }

    try
    {
        var policy = new PolicyDocument(session.TenantId, revision, parsedRules);
        rules.Publish(policy);
        return Results.Json(new
        {
            tenantId = policy.TenantId,
            revision = policy.Revision,
            rules = policy.Rules.Select(x => new { x.RuleId, x.Priority, action = x.Action.ToString(), x.DryRun, x.Scope })
        }, statusCode: 201);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { code = ex.Message, status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }
}).WithName("PublishRules");

app.MapPost("/v1/management/rules/rollback", (HttpRequest request, IConsoleAuthService auth, RulesEngine rules) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    if (!rules.Rollback(session.TenantId))
    {
        return Results.Json(new { code = "nothing_to_rollback", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    var doc = rules.GetPolicy(session.TenantId);
    return Results.Json(new
    {
        tenantId = session.TenantId,
        revision = doc?.Revision ?? "none",
        rolledBack = true
    });
}).WithName("RollbackRules");

app.MapGet("/v1/management/webhooks", (HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var env = request.Query["environmentId"].ToString();
    if (string.IsNullOrWhiteSpace(env)) env = null;
    var items = webhooks.ListSubscriptions(session!.TenantId, env).Select(s => new
    {
        subscriptionId = s.SubscriptionId,
        environmentId = s.EnvironmentId,
        targetUrl = s.TargetUrl,
        eventFilters = s.EventFilters.ToArray(),
        enabled = s.Enabled,
        createdAt = s.CreatedAt,
        secretMasked = "whsec_****"
    });
    return Results.Json(new { items });
}).WithName("ListWebhooks");

app.MapPost("/v1/management/webhooks", async (HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var env = doc.RootElement.TryGetProperty("environmentId", out var e) ? e.GetString() ?? "dev" : "dev";
    var url = doc.RootElement.TryGetProperty("targetUrl", out var u) ? u.GetString() ?? "" : "";
    var filters = doc.RootElement.TryGetProperty("eventFilters", out var f) && f.ValueKind == JsonValueKind.Array
        ? f.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray()
        : new[] { WebhookEventTypes.EventIdentification };
    try
    {
        var sub = webhooks.CreateSubscription(session.TenantId, env, url, filters);
        return Results.Json(new
        {
            subscriptionId = sub.SubscriptionId,
            environmentId = sub.EnvironmentId,
            targetUrl = sub.TargetUrl,
            eventFilters = sub.EventFilters.ToArray(),
            enabled = sub.Enabled,
            secretOnce = sub.SigningSecret
        }, statusCode: 201);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { code = ex.Message, status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }
}).WithName("CreateWebhook");

app.MapPost("/v1/management/webhooks/{subscriptionId}/rotate", (string subscriptionId, HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    var existing = webhooks.GetSubscription(subscriptionId);
    if (existing is null || existing.TenantId != session.TenantId)
    {
        return Results.Json(new { code = "webhook_not_found", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    if (!webhooks.RotateSecret(subscriptionId, out var secret) || secret is null)
    {
        return Results.Json(new { code = "rotate_failed", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    return Results.Json(new { subscriptionId, secretOnce = secret });
}).WithName("RotateWebhookSecret");

app.MapGet("/v1/management/webhooks/deliveries", (HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var items = webhooks.ListDeliveries(session!.TenantId).Select(d => new
    {
        deliveryId = d.DeliveryId,
        subscriptionId = d.SubscriptionId,
        eventType = d.EventType,
        status = d.Status,
        attempts = d.Attempts,
        lastError = d.LastError,
        createdAt = d.CreatedAt
    });
    return Results.Json(new { items });
}).WithName("ListWebhookDeliveries");

app.MapPost("/v1/management/webhooks/deliveries/{deliveryId}/replay", (string deliveryId, HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    var match = webhooks.ListDeliveries(session!.TenantId).FirstOrDefault(d => d.DeliveryId == deliveryId);
    if (match is null)
    {
        return Results.Json(new { code = "delivery_not_found", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    if (!webhooks.ReplayDead(deliveryId))
    {
        return Results.Json(new { code = "replay_not_eligible", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    return Results.Json(new { deliveryId, status = "pending" });
}).WithName("ReplayWebhookDelivery");

app.MapPost("/v1/management/webhooks/{subscriptionId}/enqueue", async (string subscriptionId, HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    var sub = webhooks.GetSubscription(subscriptionId);
    if (sub is null || sub.TenantId != session!.TenantId)
    {
        return Results.Json(new { code = "webhook_not_found", status = 404 }, statusCode: 404, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var eventType = doc.RootElement.TryGetProperty("eventType", out var et) ? et.GetString() ?? WebhookEventTypes.EventIdentification : WebhookEventTypes.EventIdentification;
    try
    {
        var deliveryId = webhooks.Enqueue(subscriptionId, eventType, new { source = "console", at = DateTimeOffset.UtcNow });
        return Results.Json(new { deliveryId, status = "pending" }, statusCode: 201);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { code = ex.Message, status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }
}).WithName("EnqueueWebhook");

app.MapPost("/v1/management/webhooks/process", async (HttpRequest request, IConsoleAuthService auth, IWebhookOutboundService webhooks) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    _ = session;
    var processed = await webhooks.ProcessPendingAsync();
    var dead = webhooks.ListDeliveries(session!.TenantId).Count(d => d.Status is "dead" or "circuit_open");
    return Results.Json(new { processed, deadLetter = dead });
}).WithName("ProcessWebhooks");

app.MapGet("/v1/management/bots/verify", (HttpRequest request, IConsoleAuthService auth, BotIdentityVerifier bots) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var ua = request.Query["userAgent"].ToString();
    if (string.IsNullOrWhiteSpace(ua)) ua = null;
    var signed = request.Query["signedIdentity"].ToString();
    if (string.IsNullOrWhiteSpace(signed)) signed = null;
    var result = bots.Verify(session!.TenantId, ua, signed, DateTimeOffset.UtcNow);
    return Results.Json(new
    {
        classification = result.Classification.ToString(),
        status = result.Status,
        provider = result.Provider,
        evidence = result.Evidence
    });
}).WithName("VerifyBotIdentity");

app.MapPost("/v1/management/velocity/enable", (HttpRequest request, IConsoleAuthService auth, BehaviorVelocityModule velocity) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    velocity.Enabled = true;
    return Results.Json(new { enabled = true });
}).WithName("EnableVelocity");

app.MapPost("/v1/management/velocity/record", async (HttpRequest request, IConsoleAuthService auth, BehaviorVelocityModule velocity) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var account = doc.RootElement.TryGetProperty("accountHash", out var a) ? a.GetString() ?? "acc_demo" : "acc_demo";
    var typeStr = doc.RootElement.TryGetProperty("type", out var t) ? t.GetString() ?? "LoginFailure" : "LoginFailure";
    if (!Enum.TryParse<BehaviorEventType>(typeStr, ignoreCase: true, out var type)) type = BehaviorEventType.LoginFailure;
    var terminal = doc.RootElement.TryGetProperty("sharedTerminalId", out var s) ? s.GetString() : null;
    if (!velocity.Enabled) velocity.Enabled = true;
    velocity.Record(new BehaviorEvent(session!.TenantId, account, type, DateTimeOffset.UtcNow, terminal));
    return Results.Json(new { ok = true, enabled = velocity.Enabled });
}).WithName("RecordVelocity");

app.MapGet("/v1/management/velocity", (HttpRequest request, IConsoleAuthService auth, BehaviorVelocityModule velocity) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var account = request.Query["accountHash"].ToString();
    if (string.IsNullOrWhiteSpace(account)) account = "acc_demo";
    var agg = velocity.Aggregate(session!.TenantId, account, DateTimeOffset.UtcNow, TimeSpan.FromHours(1));
    return Results.Json(new
    {
        enabled = velocity.Enabled,
        accountHash = account,
        status = agg.Status,
        loginFailures = agg.LoginFailures,
        registrationRetries = agg.RegistrationRetries,
        stepUpFailures = agg.StepUpFailures,
        burstNote = agg.BurstNote
    });
}).WithName("GetVelocity");

app.MapGet("/v1/management/signals/catalog", (HttpRequest request, IConsoleAuthService auth, UnifiedSignalRegistry signals) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    _ = session;
    return Results.Json(new
    {
        items = signals.Catalog.Select(c => new
        {
            signalId = c.SignalId,
            channel = c.Channel,
            evaluable = c.Evaluable,
            deferralReason = c.DeferralReason
        })
    });
}).WithName("ListSignalCatalog");

app.MapPost("/v1/management/signals/evaluate", async (HttpRequest request, IConsoleAuthService auth, UnifiedSignalRegistry signals) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var input = EnvironmentProbeMapper.FromJson(doc.RootElement, ReadSignatureAgent(request));
    var outcomes = signals.EvaluateAllWeb(input, "console:" + session!.TenantId);
    return Results.Json(new
    {
        items = outcomes.Select(o => new
        {
            signalId = o.SignalId,
            status = o.Status,
            triState = o.TriState.ToString(),
            value = o.Value,
            confidence = o.Confidence,
            evidence = o.Evidence
        })
    });
}).WithName("EvaluateSignals");

app.MapGet("/v1/management/projects", (HttpRequest request, IConsoleAuthService auth, IManagementApiService mgmt) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var (status, body) = mgmt.ListProjects(session!.TenantId, session.Username, session.Role, null, 50);
    return status >= 400
        ? Results.Json(body, statusCode: status, contentType: "application/problem+json")
        : Results.Json(body, statusCode: status);
}).WithName("ListProjects");

app.MapPost("/v1/management/projects", async (HttpRequest request, IConsoleAuthService auth, IManagementApiService mgmt) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var name = doc.RootElement.TryGetProperty("name", out var n) ? n.GetString() ?? "project" : "project";
    var (status, body) = mgmt.CreateProject(session!.TenantId, name, session.Username, session.Role);
    return status >= 400
        ? Results.Json(body, statusCode: status, contentType: "application/problem+json")
        : Results.Json(body, statusCode: status);
}).WithName("CreateProject");

app.MapPatch("/v1/management/projects/{projectId}", async (string projectId, HttpRequest request, IConsoleAuthService auth, IManagementApiService mgmt) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var name = doc.RootElement.TryGetProperty("name", out var n) ? n.GetString() : null;
    int? retention = doc.RootElement.TryGetProperty("retentionDays", out var r) && r.TryGetInt32(out var days) ? days : null;
    var ifMatch = doc.RootElement.TryGetProperty("ifMatchRevision", out var m) && m.TryGetInt64(out var rev) ? rev : 1L;
    var (status, body) = mgmt.PatchProject(session!.TenantId, projectId, name, retention, ifMatch, session.Username, session.Role);
    return status >= 400
        ? Results.Json(body, statusCode: status, contentType: "application/problem+json")
        : Results.Json(body, statusCode: status);
}).WithName("PatchProject");

app.MapGet("/v1/management/audit", (HttpRequest request, IConsoleAuthService auth, IManagementApiService mgmt) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var items = mgmt.ListAudit(session!.TenantId).Select(a => new
    {
        auditId = a.AuditId,
        actor = a.Actor,
        role = a.Role,
        action = a.Action,
        resourceType = a.ResourceType,
        resourceId = a.ResourceId,
        at = a.At,
        signature = a.Signature
    });
    return Results.Json(new { items });
}).WithName("ListAudit");

app.MapGet("/v1/management/usage", (HttpRequest request, IConsoleAuthService auth, IMeteringService metering) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var projectId = request.Query["projectId"].ToString();
    if (string.IsNullOrWhiteSpace(projectId)) projectId = "default";
    var env = request.Query["environmentId"].ToString();
    if (string.IsNullOrWhiteSpace(env)) env = "dev";
    var used = metering.GetUsage(session!.TenantId, projectId, env);
    return Results.Json(new { tenantId = session.TenantId, projectId, environmentId = env, used, unit = "events" });
}).WithName("GetUsage");

app.MapGet("/v1/management/graph", (HttpRequest request, IConsoleAuthService auth, IIdentityGraphService graph, FraudRingGraph rings) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    var visitorId = request.Query["visitorId"].ToString();
    var projected = graph.ProjectActiveEdges(session!.TenantId);
    if (!string.IsNullOrWhiteSpace(visitorId))
    {
        projected = projected
            .Where(p => p.Edge.FromVisitorId == visitorId || p.Edge.ToVisitorId == visitorId)
            .ToList();
    }

    var edges = projected.Select(p => new
    {
        edgeId = p.Edge.EdgeId,
        from = p.Edge.FromVisitorId,
        to = p.Edge.ToVisitorId,
        edgeType = p.Edge.EdgeType,
        evidenceStatus = p.Edge.EvidenceStatus,
        confidence = p.Edge.Confidence,
        effectiveConfidence = Math.Round(p.EffectiveConfidence, 4),
        decayNote = p.DecayNote,
        provenance = p.Edge.Provenance,
        investigationOnly = true
    });
    var leads = rings.DetectLeads().Select(l => new
    {
        componentId = l.ComponentId,
        nodeIds = l.NodeIds,
        score = l.Score,
        status = l.Status,
        explanations = l.Explanations
    });
    return Results.Json(new
    {
        tenantId = session.TenantId,
        halfLifeDays = 180,
        edges,
        ringLeads = leads,
        disclaimer = "investigation_lead_not_definitive_fraud"
    });
}).WithName("GetIdentityGraph");

app.MapPost("/v1/management/graph/edges", async (HttpRequest request, IConsoleAuthService auth, IIdentityGraphService graph) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.Security or AdminRole.Analyst))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var from = doc.RootElement.TryGetProperty("from", out var f) ? f.GetString() ?? "" : "";
    var to = doc.RootElement.TryGetProperty("to", out var t) ? t.GetString() ?? "" : "";
    var edgeType = doc.RootElement.TryGetProperty("edgeType", out var et) ? et.GetString() ?? "link" : "link";
    var conf = doc.RootElement.TryGetProperty("confidence", out var c) && c.TryGetDouble(out var cd) ? cd : 0.7;
    if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
    {
        return Results.Json(new { code = "from_to_required", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    var edge = graph.AddEdge(new NightWatch.Modules.Identity.Matching.GraphEdge
    {
        EdgeId = "ge_" + Guid.NewGuid().ToString("N")[..12],
        TenantId = session.TenantId,
        FromVisitorId = from,
        ToVisitorId = to,
        EdgeType = edgeType,
        EvidenceType = "console_hypothesis",
        EvidenceStatus = "insufficient_evidence",
        Confidence = Math.Clamp(conf, 0, 1),
        Provenance = "admin_console",
        ModelVersion = "graph-project-v1",
        CreatedAt = DateTimeOffset.UtcNow,
        Explanation = "manual_investigation_edge"
    });
    return Results.Json(new { edgeId = edge.EdgeId, from = edge.FromVisitorId, to = edge.ToVisitorId, status = "created" }, statusCode: 201);
}).WithName("AddGraphEdge");

app.MapGet("/v1/lab/accuracy", () =>
{
    var report = AccuracyHarness.Run();
    return Results.Json(new
    {
        reportVersion = report.ReportVersion,
        generatedAt = report.GeneratedAt,
        scenarioCount = report.ScenarioCount,
        passCount = report.PassCount,
        passRate = report.PassRate,
        calibrationStatus = report.CalibrationStatus,
        note = report.Note,
        scenarios = report.Scenarios.Select(s => new
        {
            scenarioId = s.ScenarioId,
            expectedDecision = s.ExpectedDecision,
            actualDecision = s.ActualDecision,
            score = s.Score,
            pass = s.Pass,
            note = s.Note
        })
    });
}).WithName("LabAccuracyHarness");

app.MapPost("/v1/lab/calibration/run", async (HttpRequest request, FraudFeedbackPipeline pipeline) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var tenantId = doc.RootElement.TryGetProperty("tenantId", out var t) ? t.GetString() ?? "default" : "default";
    var modelVersion = doc.RootElement.TryGetProperty("modelVersion", out var m)
        ? m.GetString() ?? $"holdout-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"
        : $"holdout-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";

    // Seed minimal synthetic labels when empty so harness is exercisable in lab.
    if (pipeline.List(tenantId).Count < 4)
    {
        for (var i = 0; i < 6; i++)
        {
            pipeline.Adjudicate(new FeedbackCase(
                tenantId,
                $"lab_case_{i}",
                $"vh_{i:x8}deadbeef",
                DateTimeOffset.UtcNow.AddDays(-10 + i),
                i % 2 == 0 ? FraudLabel.ConfirmedFraud : FraudLabel.Legitimate,
                "lab_seed",
                DateTimeOffset.UtcNow,
                "synthetic_holdout_seed"));
        }
    }

    var report = pipeline.EvaluateSyntheticBaseline(tenantId, modelVersion);
    var activate = !doc.RootElement.TryGetProperty("activate", out var a) || a.ValueKind != JsonValueKind.False;
    if (activate && report.HoldoutCount > 0)
    {
        pipeline.Activate(modelVersion);
    }

    return Results.Json(new
    {
        modelVersion = report.ModelVersion,
        trainCount = report.TrainCount,
        holdoutCount = report.HoldoutCount,
        rocAuc = report.RocAuc,
        averagePrecision = report.AveragePrecision,
        calibrationError = report.CalibrationError,
        leakageWarnings = report.LeakageWarnings,
        datasetKind = report.DatasetKind,
        activeModelId = pipeline.ActiveModelId,
        confidenceClaim = "holdout_metrics_only_not_production_calibrated_ml",
        note = "Use metrics for operator review; identify confidenceStatus remains heuristic until labeled production data exists."
    });
}).WithName("LabCalibrationRun");

app.MapPost("/v1/lab/network/lookup", async (HttpRequest request, AsnReputationStore asnStore) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var key = doc.RootElement.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
    if (string.IsNullOrWhiteSpace(key))
    {
        return Results.Json(new { code = "key_required", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    var (status, rec) = asnStore.Lookup(key.Trim(), DateTimeOffset.UtcNow);
    return Results.Json(new
    {
        key,
        status,
        kind = rec?.Kind,
        label = rec?.Label,
        provenance = rec?.Provenance,
        expiresAt = rec?.ExpiresAt,
        note = "offline_signed_feed_no_saas_fetch"
    });
}).WithName("LabNetworkLookup");

app.MapPost("/v1/management/score/feedback", async (
    HttpRequest request,
    IConsoleAuthService auth,
    SuspectScoreFeedbackTrainer trainer) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var caseId = doc.RootElement.TryGetProperty("caseId", out var c) ? c.GetString() ?? "" : "";
    var visitorHash = doc.RootElement.TryGetProperty("visitorIdHash", out var v) ? v.GetString() ?? "" : "";
    var label = doc.RootElement.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "";
    var notes = doc.RootElement.TryGetProperty("notes", out var n) ? n.GetString() : null;
    if (string.IsNullOrWhiteSpace(caseId) || string.IsNullOrWhiteSpace(visitorHash) || string.IsNullOrWhiteSpace(label))
    {
        return Results.Json(new { code = "feedback_fields_required", status = 400 }, statusCode: 400, contentType: "application/problem+json");
    }

    var result = trainer.Apply(session!.TenantId, caseId, visitorHash, label, session.Username, notes);
    return Results.Json(result);
}).WithName("ApplyScoreFeedback");

app.MapPost("/v1/management/score/explain", async (
    HttpRequest request,
    IConsoleAuthService auth,
    UnifiedSignalRegistry signals,
    SuspectScoreEngine scores,
    AsnReputationStore asnStore) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var input = EnvironmentProbeMapper.FromJson(doc.RootElement, ReadSignatureAgent(request));
    input = NetworkReputationEnricher.Enrich(input, ReadNetworkContext(request), asnStore);
    var outcomes = signals.EvaluateAllWeb(input, cacheKeySuffix: "explain:" + session!.TenantId);
    var result = scores.Score(session.TenantId, outcomes);
    return Results.Json(new
    {
        tenantId = result.TenantId,
        version = result.Version,
        score = result.Score,
        decision = result.Decision,
        mode = result.Mode,
        scoreKind = result.ScoreKind,
        facets = result.Facets,
        contributions = result.Contributions.Select(c => new
        {
            signalId = c.SignalId,
            weight = c.Weight,
            appliedPoints = c.AppliedPoints,
            triState = c.TriState.ToString(),
            kind = c.Kind,
            reasonCode = c.ReasonCode
        }),
        unknownSignals = result.UnknownSignals,
        reasonCodes = result.ReasonCodes,
        receipt = "heuristic_weighted_not_calibrated_ml"
    });
}).WithName("ExplainSuspectScore");

app.MapGet("/v1/management/privacy/tombstones", (HttpRequest request, IConsoleAuthService auth, IVisitorLifecycleService lifecycle) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    return Results.Json(new { items = lifecycle.ListTombstones(session.TenantId) });
}).WithName("ListPrivacyTombstones");

app.MapGet("/v1/management/privacy/jobs", (HttpRequest request, IConsoleAuthService auth, IVisitorLifecycleService lifecycle) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: false, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    return Results.Json(new { items = lifecycle.ListErasureJobs(session.TenantId) });
}).WithName("ListPrivacyJobs");

app.MapPost("/v1/management/privacy/export/{visitorId}", (string visitorId, HttpRequest request, IConsoleAuthService auth, IVisitorLifecycleService lifecycle) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    var (status, body) = lifecycle.ExportVisitor(visitorId, session.TenantId, "secret", session.Username);
    return status >= 400
        ? Results.Json(body, statusCode: status, contentType: "application/problem+json")
        : Results.Json(body, statusCode: status);
}).WithName("ConsolePrivacyExport");

app.MapPost("/v1/management/privacy/erase/{visitorId}", async (string visitorId, HttpRequest request, IConsoleAuthService auth, IVisitorLifecycleService lifecycle, IIdentityGraphService graph) =>
{
    if (!TryConsoleAuth(request, auth, requireCsrf: true, out var session, out var fail)) return fail!;
    if (session!.Role is not (AdminRole.Administrator or AdminRole.DataProtectionOfficer))
    {
        return Results.Json(new { code = "forbidden_role", status = 403 }, statusCode: 403, contentType: "application/problem+json");
    }

    using var doc = await JsonDocument.ParseAsync(request.Body);
    var reason = doc.RootElement.TryGetProperty("reason", out var r) ? r.GetString() ?? "dpo_erasure" : "dpo_erasure";
    var (status, body) = lifecycle.DeleteVisitor(visitorId, session.TenantId, "secret", session.Username, reason);
    if (status < 400)
    {
        graph.DeleteVisitorCascade(session.TenantId, visitorId);
    }

    return status >= 400
        ? Results.Json(body, statusCode: status, contentType: "application/problem+json")
        : Results.Json(body, statusCode: status);
}).WithName("ConsolePrivacyErase");

app.Run();

static JsonSerializerOptions CreateIdentifyJsonOptions() => new()
{
    PropertyNameCaseInsensitive = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

static string? ReadConsoleSessionId(HttpRequest request)
{
    if (request.Cookies.TryGetValue(ConsoleAuthService.SessionCookieName, out var cookie) && !string.IsNullOrWhiteSpace(cookie))
    {
        return cookie;
    }

    if (request.Headers.TryGetValue("Authorization", out var auth) &&
        auth.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return auth.ToString()["Bearer ".Length..].Trim();
    }

    if (request.Headers.TryGetValue("X-Console-Session", out var sid))
    {
        return sid.ToString();
    }

    return null;
}

static string? ReadSignatureAgent(HttpRequest request)
{
    if (request.Headers.TryGetValue("Signature-Agent", out var sig) && !string.IsNullOrWhiteSpace(sig))
    {
        return sig.ToString();
    }

    return null;
}

static NetworkLookupContext ReadNetworkContext(HttpRequest request)
{
    request.Headers.TryGetValue("X-Forwarded-For", out var xff);
    request.Headers.TryGetValue("X-Client-Ip", out var cip);
    request.Headers.TryGetValue("X-Client-Asn", out var asn);
    return new NetworkLookupContext(
        string.IsNullOrWhiteSpace(xff) ? null : xff.ToString(),
        string.IsNullOrWhiteSpace(cip) ? null : cip.ToString(),
        string.IsNullOrWhiteSpace(asn) ? null : asn.ToString());
}

static SmartSignalInput ApplyPopulationAndEdgeSignals(
    SmartSignalInput input,
    HttpRequest request,
    string tenantId,
    LocalDevicePopulationStore population)
{
    if (input.DeviceAttrs is { Count: > 0 })
    {
        population.Observe(tenantId, input.DeviceAttrs);
        var (rarity, _, total, status) = population.Query(tenantId, input.DeviceAttrs);
        if (status == "local_baseline" && total >= 5)
        {
            input = input with { PopulationRarity = rarity };
        }
    }

    // Edge / gateway TLS MITM hints (honest — only when present).
    if (input.MitmHints is null)
    {
        if (request.Headers.TryGetValue("X-Mitm-Suspected", out var mitm) &&
            bool.TryParse(mitm.ToString(), out var mitmFlag))
        {
            input = input with { MitmHints = mitmFlag };
        }
        else if (request.Headers.TryGetValue("X-TLS-Fingerprint", out var fp) &&
                 request.Headers.TryGetValue("X-Expected-TLS-Fingerprint", out var expect) &&
                 !string.IsNullOrWhiteSpace(fp) && !string.IsNullOrWhiteSpace(expect) &&
                 !string.Equals(fp.ToString(), expect.ToString(), StringComparison.Ordinal))
        {
            input = input with { MitmHints = true };
        }
        else if (request.Headers.ContainsKey("X-TLS-Version") || request.IsHttps)
        {
            // Presence of TLS termination signal without mismatch → not detected.
            input = input with { MitmHints = false };
        }
    }

    return input;
}

static bool TryConsoleAuth(
    HttpRequest request,
    IConsoleAuthService auth,
    bool requireCsrf,
    out ConsoleSession? session,
    out IResult? fail)
{
    session = null;
    fail = null;
    var sid = ReadConsoleSessionId(request);
    if (requireCsrf)
    {
        request.Headers.TryGetValue(ConsoleAuthService.CsrfHeaderName, out var csrf);
        var (ok, code) = auth.ValidateCsrf(sid, csrf.ToString());
        if (!ok)
        {
            fail = Results.Json(new { code, title = code, status = 403 }, statusCode: 403, contentType: "application/problem+json");
            return false;
        }
    }

    var (valid, s, vcode) = auth.ValidateSession(sid);
    if (!valid || s is null)
    {
        fail = Results.Json(new { code = vcode, title = vcode, status = 401 }, statusCode: 401, contentType: "application/problem+json");
        return false;
    }

    session = s;
    return true;
}

static async Task WriteReadyResponseAsync(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";
    // Never include connection strings, keys, or stack traces.
    var payload = new
    {
        status = report.Status.ToString().ToLowerInvariant(),
        product = ProductIdentity.ProductCode,
        checks = report.Entries.ToDictionary(
            e => e.Key,
            e => new
            {
                status = e.Value.Status.ToString().ToLowerInvariant(),
                description = e.Value.Description
            })
    };
    await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
}

/// <summary>
/// Readiness without probing foreign networks. Postgres/Redis wiring arrives in later steps;
/// until configured, readiness is healthy for process+modules only and marks data stores unavailable.
/// </summary>
file sealed class ReadinessHealthCheck(IEnumerable<IProPlusModule> modules, IConfiguration config) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var moduleCount = modules.Count();
        if (moduleCount != ModuleNames.All.Count)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy($"expected {ModuleNames.All.Count} modules, got {moduleCount}"));
        }

        var pg = config.GetConnectionString("Postgres");
        var redis = config.GetConnectionString("Redis");
        var data = new Dictionary<string, object>
        {
            ["modules"] = moduleCount,
            ["postgres"] = string.IsNullOrWhiteSpace(pg) ? "unavailable" : "configured",
            ["redis"] = string.IsNullOrWhiteSpace(redis) ? "unavailable" : "configured"
        };

        // No secrets in description.
        return Task.FromResult(HealthCheckResult.Healthy("modules_registered", data));
    }
}

public partial class Program;
