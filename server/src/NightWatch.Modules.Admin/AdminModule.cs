using NightWatch.BuildingBlocks;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Admin;

public sealed class AdminModule : IProPlusModule
{
    public string Name => ModuleNames.Admin;
}

public static class AdminServiceCollectionExtensions
{
    public static IServiceCollection AddAdminModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, AdminModule>();
        services.AddSingleton<IApiCredentialService, ApiCredentialService>();
        services.AddSingleton<IManagementApiService, ManagementApiService>();
        services.AddSingleton<IConsoleAuthService, ConsoleAuthService>();
        services.AddSingleton<IConsoleMfaService, ConsoleMfaService>();
        return services;
    }
}
