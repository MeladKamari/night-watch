using NightWatch.BuildingBlocks;
using NightWatch.Modules.Identity.Matching;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Identity;

public sealed class IdentityModule : IProPlusModule
{
    public string Name => ModuleNames.Identity;
}

public static class IdentityServiceCollectionExtensions
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, IdentityModule>();
        services.AddSingleton<IdentifyOptions>();
        services.AddSingleton<EventQueryOptions>();
        services.AddSingleton<EventSearchOptions>();
        services.AddSingleton<VisitorLifecycleOptions>();
        services.AddSingleton<IIdentifyChallengeService, IdentifyChallengeService>();
        services.AddSingleton<IVisitorErasureRegistry, InMemoryVisitorErasureRegistry>();
        services.AddSingleton<IIdentificationEventCatalog, InMemoryIdentificationEventCatalog>();
        services.AddSingleton<IIdentifyService, IdentifyService>();
        services.AddSingleton<IEventQueryService, EventQueryService>();
        services.AddSingleton<IEventSearchService, EventSearchService>();
        services.AddSingleton<IEventAnnotationService, EventAnnotationService>();
        services.AddSingleton<IVisitorLifecycleService, VisitorLifecycleService>();
        services.AddSingleton<IIdentityGraphService, IdentityGraphService>();
        services.AddSingleton<ICandidateRetrievalService, CandidateRetrievalService>();
        services.AddSingleton<IDeviceVectorStore>(sp =>
        {
            var sink = sp.GetService<IDeviceVectorDurableSink>();
            return new DeviceVectorStore(sink);
        });
        services.AddSingleton<IVisitorAliasStore>(sp =>
        {
            var sink = sp.GetService<IVisitorAliasDurableSink>();
            return new VisitorAliasStore(sink);
        });
        services.AddSingleton<IHoldoutConfidenceSource, NullHoldoutConfidenceSource>();
        services.AddSingleton<FirstPartyCookieOptions>();
        services.AddSingleton<IFirstPartySessionCookieService, FirstPartySessionCookieService>();
        services.AddSingleton<SealedEnvelopeOptions>();
        services.AddSingleton<ISealedResultEnvelopeService, SealedResultEnvelopeService>();
        services.AddSingleton<ZeroTrustOptions>();
        services.AddSingleton<IZeroTrustVerificationService, ZeroTrustVerificationService>();
        return services;
    }
}
