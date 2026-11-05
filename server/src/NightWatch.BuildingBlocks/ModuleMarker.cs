namespace NightWatch.BuildingBlocks;

public interface IProPlusModule
{
    string Name { get; }
}

public static class ModuleNames
{
    public const string Ingestion = "Ingestion";
    public const string Identity = "Identity";
    public const string Intelligence = "Intelligence";
    public const string Risk = "Risk";
    public const string Admin = "Admin";
    public const string Webhooks = "Webhooks";
    public const string Privacy = "Privacy";
    public const string Reporting = "Reporting";

    public static readonly IReadOnlyList<string> All =
    [
        Ingestion, Identity, Intelligence, Risk, Admin, Webhooks, Privacy, Reporting
    ];
}
