using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.JSInterop;

namespace NightWatch.Blazor;

/// <summary>
/// Thin Blazor wrapper around <c>window.NightWatchBlazor.identify</c>
/// (NuGet package <c>NightWatch.Blazor</c>).
/// </summary>
public sealed class NightWatchJs(IJSRuntime js)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Calls JS identify and returns a JSON-safe payload.
    /// Ensure the Night Watch interop script is loaded first
    /// (<c>installNightWatchBlazorGlobal()</c> or your bundled module).
    /// </summary>
    public async Task<NightWatchIdentifyResult> IdentifyAsync(
        NightWatchIdentifyOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var json = options is null
            ? null
            : JsonSerializer.Serialize(options, JsonOptions);

        return await js.InvokeAsync<NightWatchIdentifyResult>(
            "NightWatchBlazor.identify",
            cancellationToken,
            json);
    }
}

public sealed class NightWatchIdentifyOptions
{
    public int? DelayFallback { get; set; }
    public bool? Debug { get; set; }
    public bool? Monitoring { get; set; }
}

public sealed class NightWatchIdentifyResult
{
    public string VisitorId { get; set; } = "";
    public string Version { get; set; } = "";
    public double? ConfidenceScore { get; set; }
    public string? ConfidenceComment { get; set; }
}
