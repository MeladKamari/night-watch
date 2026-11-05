using System.Runtime.CompilerServices;

namespace NightWatch.Api.Tests;

/// <summary>
/// Points durable EF state at a unique SQLite file so API tests do not rematch
/// aliases left in the shared night-watch-dev.db from prior runs or the live API.
/// </summary>
internal static class TestSqliteIsolation
{
    [ModuleInitializer]
    internal static void Init()
    {
        var path = Path.Combine(Path.GetTempPath(), $"night-watch-tests-{Guid.NewGuid():N}.db");
        Environment.SetEnvironmentVariable("NIGHT_WATCH_TEST_SQLITE", path);
    }
}
