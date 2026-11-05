using NightWatch.Modules.Identity.Matching;
using NightWatch.Modules.Risk.Feedback;

/// <summary>Bridges fraud-feedback active model metrics into identify confidence (holdout_backed).</summary>
public sealed class FeedbackHoldoutConfidenceSource(FraudFeedbackPipeline pipeline) : IHoldoutConfidenceSource
{
    public HoldoutBacking Get(string tenantId)
    {
        var modelId = pipeline.ActiveModelId;
        if (string.IsNullOrWhiteSpace(modelId))
        {
            return new HoldoutBacking(null, null, 0);
        }

        var model = pipeline.GetModel(modelId);
        if (model is null || model.Status != "active")
        {
            return new HoldoutBacking(null, null, 0);
        }

        model.Metrics.TryGetValue("roc_auc", out var auc);
        if (double.IsNaN(auc)) auc = 0;
        var holdout = pipeline.TemporalHoldout(tenantId).Holdout.Count;
        if (holdout == 0)
        {
            holdout = pipeline.TemporalHoldout("default").Holdout.Count;
        }

        return new HoldoutBacking(modelId, auc > 0 ? auc : null, holdout);
    }
}
