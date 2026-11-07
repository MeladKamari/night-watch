using System.Text.Json;
using Google.Protobuf.Collections;
using NightWatch.Api.Grpc.V1;
using NightWatch.BuildingBlocks.Hashing;

namespace NightWatch.Api.Grpc;

internal static class ComponentProtoMapper
{
    public static JsonElement ToJsonElement(
        MapField<string, ComponentValue> components,
        string? componentsJson)
    {
        if (components is { Count: > 0 })
        {
            return FromMap(components);
        }

        if (!string.IsNullOrWhiteSpace(componentsJson))
        {
            using var doc = JsonDocument.Parse(componentsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new InvalidOperationException("components_json must be a JSON object");
            }

            return doc.RootElement.Clone();
        }

        throw new InvalidOperationException("components or components_json required");
    }

    public static (string VisitorId, string Canonical) Hash(
        MapField<string, ComponentValue> components,
        string? componentsJson)
    {
        var el = ToJsonElement(components, componentsJson);
        return (ComponentHasher.HashComponents(el), ComponentHasher.ComponentsToCanonicalString(el));
    }

    private static JsonElement FromMap(MapField<string, ComponentValue> components)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            foreach (var (key, val) in components.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            {
                writer.WritePropertyName(key);
                writer.WriteStartObject();
                if (val.HasError)
                {
                    writer.WritePropertyName("error");
                    WriteJsonOrString(writer, val.ErrorJson, fallback: "error");
                }
                else
                {
                    writer.WritePropertyName("value");
                    WriteJsonOrNull(writer, val.ValueJson);
                }

                writer.WriteNumber("duration", val.DurationMs);
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
        }

        return JsonDocument.Parse(stream.ToArray()).RootElement.Clone();
    }

    private static void WriteJsonOrNull(Utf8JsonWriter writer, string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            writer.WriteNullValue();
            return;
        }

        using var doc = JsonDocument.Parse(json);
        doc.RootElement.WriteTo(writer);
    }

    private static void WriteJsonOrString(Utf8JsonWriter writer, string? json, string fallback)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            writer.WriteStringValue(fallback);
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            doc.RootElement.WriteTo(writer);
        }
        catch (JsonException)
        {
            writer.WriteStringValue(json);
        }
    }
}
