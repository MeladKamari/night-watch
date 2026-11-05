using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace NightWatch.BuildingBlocks.Configuration;

public static class ProPlusConfigurationExtensions
{
    public static IServiceCollection AddProPlusOptions(this IServiceCollection services)
    {
        services.AddSingleton<IValidateOptions<ProPlusOptions>, ProPlusOptionsValidator>();
        services
            .AddOptions<ProPlusOptions>()
            .BindConfiguration(ProPlusOptions.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();
        return services;
    }
}
