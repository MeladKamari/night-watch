using NightWatch.BuildingBlocks;
using NightWatch.Modules.Intelligence.Pipeline;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Intelligence;

public sealed class IntelligenceModule : IProPlusModule
{
    public string Name => ModuleNames.Intelligence;
}

public static class IntelligenceServiceCollectionExtensions
{
    public static IServiceCollection AddIntelligenceModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, IntelligenceModule>();
        services.AddSingleton<EnrichmentPipelineOptions>();
        services.AddSingleton<IAsyncEnrichmentProvider, UnavailableAsyncEnrichmentProvider>();
        services.AddScoped<IEnrichmentPipeline, EnrichmentPipeline>();
        services.AddScoped<IEnrichmentWorker, EnrichmentWorker>();
        return services;
    }
}
