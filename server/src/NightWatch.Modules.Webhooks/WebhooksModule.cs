using NightWatch.BuildingBlocks;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Webhooks;

public sealed class WebhooksModule : IProPlusModule
{
    public string Name => ModuleNames.Webhooks;
}

public static class WebhooksServiceCollectionExtensions
{
    public static IServiceCollection AddWebhooksModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, WebhooksModule>();
        services.AddSingleton<WebhookOptions>();
        services.AddSingleton<IWebhookOutboundService, WebhookOutboundService>();
        return services;
    }
}
