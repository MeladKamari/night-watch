namespace NightWatch.BuildingBlocks.Caching;

public static class RedisKeyNames
{
    public const string Root = "ibfpp";

    public static string Idempotency(string tenantId, string environmentId, string key) =>
        $"{Root}:t:{tenantId}:e:{environmentId}:idem:{key}";

    public static string Velocity(string tenantId, string environmentId, string bucket) =>
        $"{Root}:t:{tenantId}:e:{environmentId}:vel:{bucket}";
}
