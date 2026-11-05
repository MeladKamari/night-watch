using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Persistence;

public static class PersistenceServiceCollectionExtensions
{
    public static IServiceCollection AddProPlusPersistence(
        this IServiceCollection services,
        string? postgresConnectionString)
    {
        services.AddDbContext<ProPlusDbContext>(options =>
        {
            if (string.IsNullOrWhiteSpace(postgresConnectionString))
            {
                // Isolation for WebApplicationFactory / parallel test hosts sharing the process.
                var testDb = Environment.GetEnvironmentVariable("NIGHT_WATCH_TEST_SQLITE");
                if (!string.IsNullOrWhiteSpace(testDb))
                {
                    options.UseSqlite($"Data Source={testDb}");
                }
                else
                {
                    options.UseSqlite("Data Source=night-watch-dev.db");
                }
            }
            else
            {
                options.UseNpgsql(postgresConnectionString);
            }
        });
        return services;
    }
}
