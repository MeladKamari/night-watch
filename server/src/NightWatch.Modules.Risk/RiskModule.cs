using NightWatch.BuildingBlocks;
using NightWatch.Modules.Risk.Ai;
using NightWatch.Modules.Risk.Behavior;
using NightWatch.Modules.Risk.Bots;
using NightWatch.Modules.Risk.Decisions;
using NightWatch.Modules.Risk.Extra;
using NightWatch.Modules.Risk.Feedback;
using NightWatch.Modules.Risk.Investigation;
using NightWatch.Modules.Risk.Reputation;
using NightWatch.Modules.Risk.Rules;
using NightWatch.Modules.Risk.SmartSignals;
using NightWatch.Modules.Risk.SuspectScore;
using Microsoft.Extensions.DependencyInjection;

namespace NightWatch.Modules.Risk;

public sealed class RiskModule : IProPlusModule
{
    public string Name => ModuleNames.Risk;
}

public static class RiskServiceCollectionExtensions
{
    public static IServiceCollection AddRiskModule(this IServiceCollection services)
    {
        services.AddSingleton<IProPlusModule, RiskModule>();
        services.AddSingleton<SmartSignalRegistry>();
        services.AddSingleton<UnifiedSignalRegistry>();
        services.AddSingleton<SuspectScoreEngine>();
        services.AddSingleton<FraudFeedbackPipeline>();
        services.AddSingleton<SuspectScoreFeedbackTrainer>();
        services.AddSingleton<RulesEngine>();
        services.AddSingleton<DecisionOrchestrator>();
        services.AddSingleton<BotIdentityVerifier>();
        services.AddSingleton<AsnReputationStore>();
        services.AddSingleton<AiScoringPluginHost>();
        services.AddSingleton<BehaviorVelocityModule>();
        services.AddSingleton<EventVelocityCounter>();
        services.AddSingleton<LocalDevicePopulationStore>();
        services.AddSingleton<FraudRingGraph>();
        services.AddSingleton<AnalystReviewQueue>();
        services.AddSingleton<SiemSoarBridge>();
        services.AddSingleton<FairnessOversight>();
        services.AddSingleton<BankingStepUpOrchestrator>();
        services.AddSingleton<DeviceTrustRegistry>();
        services.AddSingleton<CustomSignalPluginHost>();
        services.AddSingleton<PolicyAsCodeStore>();
        services.AddSingleton<SignedReleasePublisher>();
        return services;
    }
}
