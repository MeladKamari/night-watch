using NightWatch.BuildingBlocks;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Reporting;

public sealed class ReportingModule : IProPlusModule
{
    public string Name => ModuleNames.Reporting;
}

public static class ReportingServiceCollectionExtensions
{
    public static IServiceCollection AddReportingModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, ReportingModule>();
        services.AddSingleton<MeteringOptions>();
        services.AddSingleton<IMeteringService, MeteringService>();
        return services;
    }
}
