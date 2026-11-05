namespace NightWatch.Modules.Identity.Matching;

public interface IHoldoutConfidenceSource
{
    HoldoutBacking Get(string tenantId);
}

public sealed class NullHoldoutConfidenceSource : IHoldoutConfidenceSource
{
    public HoldoutBacking Get(string tenantId) => new(null, null, 0);
}
