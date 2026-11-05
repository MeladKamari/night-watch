using NightWatch.BuildingBlocks;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Ingestion;

public sealed class IngestionModule : IProPlusModule
{
    public string Name => ModuleNames.Ingestion;
}

public static class IngestionServiceCollectionExtensions
{
    public static IServiceCollection AddIngestionModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, IngestionModule>();
        services.AddSingleton<ObservationIngestOptions>();
        services.AddSingleton<IObservationIngestService, ObservationIngestService>();
        return services;
    }
}
