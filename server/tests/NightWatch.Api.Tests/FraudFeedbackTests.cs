using NightWatch.Modules.Risk.Feedback;

namespace NightWatch.Api.Tests;

public class FraudFeedbackTests
{
    [Fact]
    public void Adjudication_holdout_metrics_and_rollback()
    {
        var pipe = new FraudFeedbackPipeline();
        var t0 = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        for (var i = 0; i < 10; i++)
        {
            pipe.Adjudicate(new FeedbackCase(
                "t1",
                $"c{i}",
                VisitorIdHash: $"hash_{i:x8}",
                EventAt: t0.AddDays(i),
                Label: i % 2 == 0 ? FraudLabel.ConfirmedFraud : FraudLabel.Legitimate,
                Adjudicator: "analyst_a",
                LabeledAt: t0.AddDays(i + 1),
                Notes: null));
        }

        pipe.Adjudicate(new FeedbackCase("t1", "u1", "hash_u", t0, FraudLabel.Unknown, "analyst_a", t0, null));

        var report = pipe.EvaluateSyntheticBaseline("t1", "feedback-model-v1");
        Assert.Equal("synthetic", report.DatasetKind);
        Assert.True(report.TrainCount > 0);
        Assert.True(report.HoldoutCount > 0);
        Assert.Empty(report.LeakageWarnings);
        Assert.NotNull(report.RocAuc);
        Assert.NotNull(report.AveragePrecision);

        pipe.Activate("feedback-model-v1");
        Assert.Equal("feedback-model-v1", pipe.ActiveModelId);
        Assert.Equal("active", pipe.GetModel("feedback-model-v1")!.Status);

        pipe.Rollback("feedback-model-v1");
        Assert.Null(pipe.ActiveModelId);
        Assert.Equal("rolled_back", pipe.GetModel("feedback-model-v1")!.Status);
    }

    [Fact]
    public void Rejects_raw_pii_in_notes()
    {
        var pipe = new FraudFeedbackPipeline();
        Assert.Throws<InvalidOperationException>(() =>
            pipe.Adjudicate(new FeedbackCase("t1", "c1", "hash_ab", DateTimeOffset.UtcNow, FraudLabel.Legitimate, "a", DateTimeOffset.UtcNow, "user@example.com")));
    }
}
