using System.Text;
using System.Text.Json;

namespace NightWatch.BuildingBlocks.Hashing;

/// <summary>
/// Server-side parity with <c>hashComponents</c> / <c>componentsToCanonicalString</c>
/// from <c>@thenightwatch/core</c> (FingerprintJS OSS v5.3.0 rules).
/// </summary>
public static class ComponentHasher
{
    public const string HashingRevision = "murmur3-x64-128-canonical-v1";
    public const string ErrorSentinel = "error";

    public static string ComponentsToCanonicalString(JsonElement components)
    {
        if (components.ValueKind != JsonValueKind.Object)
        {
            return string.Empty;
        }

        var keys = new List<string>();
        foreach (var prop in components.EnumerateObject())
        {
            keys.Add(prop.Name);
        }

        keys.Sort(StringComparer.Ordinal);

        var result = new StringBuilder();
        foreach (var key in keys)
        {
            if (!components.TryGetProperty(key, out var component)
                || component.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                continue;
            }

            if (component.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            string valueToken;
            if (component.TryGetProperty("error", out _))
            {
                valueToken = ErrorSentinel;
            }
            else if (component.TryGetProperty("value", out var valueEl))
            {
                // Match JSON.stringify(value): undefined → literal "undefined" via template coercion.
                valueToken = valueEl.ValueKind == JsonValueKind.Undefined
                    ? "undefined"
                    : valueEl.GetRawText();
            }
            else
            {
                // Missing value arm — same as JSON.stringify(undefined) coercion path.
                valueToken = "undefined";
            }

            if (result.Length > 0)
            {
                result.Append('|');
            }

            result.Append(EscapeKey(key));
            result.Append(':');
            result.Append(valueToken);
        }

        return result.ToString();
    }

    public static string HashComponents(JsonElement components) =>
        MurmurHash3X64.Hash128(ComponentsToCanonicalString(components));

    public static bool TryHashComponents(JsonElement? components, out string hash)
    {
        hash = string.Empty;
        if (components is null || components.Value.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        hash = HashComponents(components.Value);
        return hash.Length == 32;
    }

    public static IReadOnlyList<string> ComponentKeys(JsonElement components)
    {
        if (components.ValueKind != JsonValueKind.Object)
        {
            return Array.Empty<string>();
        }

        var keys = new List<string>();
        foreach (var prop in components.EnumerateObject())
        {
            keys.Add(prop.Name);
        }

        return keys;
    }

    private static string EscapeKey(string key) =>
        key.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace(":", "\\:", StringComparison.Ordinal)
            .Replace("|", "\\|", StringComparison.Ordinal);
}
