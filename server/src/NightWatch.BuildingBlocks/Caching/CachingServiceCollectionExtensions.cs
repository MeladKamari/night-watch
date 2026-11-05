using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.BuildingBlocks.Caching;

public static class CachingServiceCollectionExtensions
{
    public static IServiceCollection AddProPlusCaching(this IServiceCollection services, IConfiguration config)
    {
        var redis = config.GetConnectionString("Redis")
            ?? config["NightWatch:Redis:ConnectionString"];

        if (string.IsNullOrWhiteSpace(redis))
        {
            services.AddSingleton<IIdempotencyStore, InMemoryIdempotencyStore>();
        }
        else
        {
            services.AddSingleton<IIdempotencyStore>(_ =>
            {
                try
                {
                    return RedisIdempotencyStore.ConnectAsync(redis).GetAwaiter().GetResult();
                }
                catch
                {
                    return new UnavailableIdempotencyStore();
                }
            });
        }

        services.AddSingleton<IngestDeduper>();
        return services;
    }
}
