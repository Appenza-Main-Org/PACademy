using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Shared.Persistence.ChangeTracking;

/// <summary>
/// Deterministic row checksum for the Data-Exchange change-detection pipeline.
///
/// <para><b>Algorithm (the integration contract — reproduce verbatim on any side
/// that needs to compare checksums):</b></para>
/// <list type="number">
///   <item>Take the row's data columns only; EXCLUDE the six tracking columns
///         in <see cref="ChangeTrackingColumns.Excluded"/>.</item>
///   <item>Order the remaining columns by snake_case column name, ordinal
///         ascending (invariant).</item>
///   <item>Canonicalize each value to a string:
///         <c>null</c>→<c>""</c>; <c>bool</c>→<c>"true"/"false"</c>;
///         <see cref="DateTimeOffset"/>→UTC ISO-8601 round-trip (<c>"O"</c>);
///         <see cref="DateTime"/>→UTC ISO-8601; <see cref="DateOnly"/>→<c>"yyyy-MM-dd"</c>;
///         numeric→invariant culture; columns whose name ends in <c>_json</c>
///         (e.g. <c>payload_json</c>)→canonical JSON (object keys sorted ordinal,
///         no insignificant whitespace); every other value→<c>ToString()</c>
///         under invariant culture.</item>
///   <item>Concatenate as <c>column  value</c> pairs joined by <c></c>.</item>
///   <item>SHA-256 over the UTF-8 bytes; return lowercase hex (64 chars).</item>
/// </list>
/// </summary>
public static class RowChecksum
{
    private const char UnitSeparator = '';
    private const char RecordSeparator = '';

    /// <summary>
    /// Compute the checksum over <paramref name="columns"/> — a sequence of
    /// (snake_case column name, raw CLR value). Tracking columns are dropped.
    /// </summary>
    public static string Compute(IEnumerable<KeyValuePair<string, object?>> columns)
    {
        var ordered = columns
            .Where(c => !ChangeTrackingColumns.Excluded.Contains(c.Key))
            .OrderBy(c => c.Key, StringComparer.Ordinal);

        var sb = new StringBuilder();
        var first = true;
        foreach (var (name, value) in ordered)
        {
            if (!first) sb.Append(RecordSeparator);
            first = false;
            sb.Append(name).Append(UnitSeparator).Append(Canonicalize(name, value));
        }

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexStringLower(bytes);
    }

    private static string Canonicalize(string columnName, object? value)
    {
        if (value is null) return string.Empty;

        return value switch
        {
            string s when columnName.EndsWith("_json", StringComparison.OrdinalIgnoreCase)
                => CanonicalizeJson(s),
            string s => s,
            bool b => b ? "true" : "false",
            DateTimeOffset dto => dto.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DateTime dt => dt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            TimeOnly t => t.ToString("HH:mm:ss", CultureInfo.InvariantCulture),
            byte[] bytes => Convert.ToHexStringLower(bytes),
            IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString() ?? string.Empty,
        };
    }

    /// <summary>
    /// Re-serialize a JSON string with object keys sorted (recursively) and no
    /// insignificant whitespace, so key-ordering / formatting changes never
    /// move the checksum. Non-JSON strings are returned unchanged.
    /// </summary>
    public static string CanonicalizeJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return string.Empty;
        try
        {
            var node = JsonNode.Parse(json);
            return Sort(node).ToJsonString(CompactOptions);
        }
        catch (JsonException)
        {
            return json;
        }
    }

    private static readonly JsonSerializerOptions CompactOptions = new()
    {
        WriteIndented = false,
    };

    private static JsonNode? Sort(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject obj:
            {
                var sorted = new JsonObject();
                foreach (var kvp in obj.OrderBy(p => p.Key, StringComparer.Ordinal))
                    sorted[kvp.Key] = Sort(kvp.Value?.DeepClone());
                return sorted;
            }
            case JsonArray arr:
            {
                var copy = new JsonArray();
                foreach (var item in arr)
                    copy.Add(Sort(item?.DeepClone()));
                return copy;
            }
            default:
                return node;
        }
    }
}
