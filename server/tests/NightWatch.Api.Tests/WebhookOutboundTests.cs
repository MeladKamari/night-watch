using NightWatch.Modules.Webhooks;
using Microsoft.Extensions.Logging.Abstractions;

namespace NightWatch.Api.Tests;

public class WebhookOutboundTests
{
    private static WebhookOutboundService Create() =>
        new(NullLogger<WebhookOutboundService>.Instance, new WebhookOptions
        {
            MaxAttempts = 3,
            InitialBackoff = TimeSpan.FromMilliseconds(1),
            CircuitFailureThreshold = 5
        });

    [Fact]
    public async Task Signature_and_replay_rejection_verified_in_sample_consumer()
    {
        var svc = Create();
        var sub = svc.CreateSubscription(
            "ten_wh",
            "env_dev",
            "http://127.0.0.1:9999/hooks",
            [WebhookEventTypes.EventIdentification, WebhookEventTypes.VisitorDeleted]);

        var deliveryId = svc.Enqueue(sub.SubscriptionId, WebhookEventTypes.EventIdentification, new { eventId = "ev_1" });
        WebhookDeliveryAttempt? sent = null;
        await svc.ProcessPendingAsync(a =>
        {
            sent = a;
            return Task.FromResult(new WebhookSendResult(true, 200, null));
        });

        Assert.NotNull(sent);
        var consumer = new SampleWebhookConsumer(sub.SigningSecret);
        var now = DateTimeOffset.UtcNow;
        var (ok, reason) = consumer.Consume(sent!.PayloadJson, sent.SignatureHeader, sent.TimestampUnix, now);
        Assert.True(ok);
        Assert.Null(reason);

        // Idempotent redelivery of same deliveryId.
        var (ok2, reason2) = consumer.Consume(sent.PayloadJson, sent.SignatureHeader, sent.TimestampUnix, now);
        Assert.True(ok2);
        Assert.Equal("duplicate_ignored_idempotent", reason2);

        // Bad signature rejected.
        var (bad, badReason) = consumer.Consume(sent.PayloadJson, "v1=deadbeef", sent.TimestampUnix, now);
        Assert.False(bad);
        Assert.Equal("signature_mismatch", badReason);

        // Stale timestamp / replay window rejected.
        var staleTs = now.AddMinutes(-30).ToUnixTimeSeconds();
        var staleSig = WebhookSigner.Sign(sub.SigningSecret, staleTs, sent.PayloadJson);
        var (stale, staleReason) = consumer.Consume(sent.PayloadJson, staleSig, staleTs, now);
        Assert.False(stale);
        Assert.Equal("timestamp_skew_or_replay_window", staleReason);

        Assert.Equal("delivered", svc.ListDeliveries("ten_wh").Single(d => d.DeliveryId == deliveryId).Status);
        Assert.Contains("at_least_once_not_exactly_once", sent.PayloadJson);
    }

    [Fact]
    public void Ssrf_unsafe_urls_rejected_and_secret_rotation_keeps_previous()
    {
        Assert.False(WebhookUrlValidator.Validate("http://169.254.169.254/latest").Ok);
        Assert.False(WebhookUrlValidator.Validate("http://10.0.0.5/hook").Ok);
        Assert.True(WebhookUrlValidator.Validate("http://127.0.0.1:8080/hook").Ok);
        Assert.True(WebhookUrlValidator.Validate("https://hooks.example.ir/night-watch").Ok);

        var svc = Create();
        var sub = svc.CreateSubscription("ten_wh2", "env", "https://hooks.example.ir/night-watch", [WebhookEventTypes.FeedbackUpdated]);
        var old = sub.SigningSecret;
        Assert.True(svc.RotateSecret(sub.SubscriptionId, out var neu));
        Assert.NotEqual(old, neu);
        Assert.Equal(old, svc.GetSubscription(sub.SubscriptionId)!.PreviousSigningSecret);
    }
}
