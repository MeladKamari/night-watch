using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.BuildingBlocks.Edge;

public static class EdgeServiceCollectionExtensions
{
    public static IServiceCollection AddProPlusEdgeAdapter(this IServiceCollection services)
    {
        services.AddSingleton<TrustedProxyOptions>();
        services.AddSingleton<IEdgeConnectionAdapter, EdgeConnectionAdapter>();
        return services;
    }
}
