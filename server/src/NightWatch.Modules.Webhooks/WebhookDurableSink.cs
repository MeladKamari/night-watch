namespace NightWatch.Modules.Webhooks;

/// <summary>Optional durable mirror for webhook subscriptions.</summary>
public interface IWebhookDurableSink
{
    void Upsert(WebhookSubscription subscription);
}

public sealed class NullWebhookDurableSink : IWebhookDurableSink
{
    public void Upsert(WebhookSubscription subscription) { }
}
