using NightWatch.BuildingBlocks;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Privacy;

public sealed class PrivacyModule : IProPlusModule
{
    public string Name => ModuleNames.Privacy;
}

public static class PrivacyServiceCollectionExtensions
{
    public static IServiceCollection AddPrivacyModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, PrivacyModule>();
        return services;
    }
}
