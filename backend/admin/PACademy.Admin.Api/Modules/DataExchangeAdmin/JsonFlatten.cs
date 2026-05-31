using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.DataExchangeAdmin;

/// <summary>
/// Flatten a JSON document into dotted-key string columns (and back) so the
/// document-store domains export as NORMALIZED columns instead of one opaque
/// `payload_json` cell.
///
/// <para><b>Flatten</b> — scalars become `path → invariant string`; nested
/// objects recurse with `a.b.c` keys; arrays are emitted as a single compact
/// JSON cell at their key (flattening arrays into indexed columns would make
/// the column set explode unpredictably).</para>
///
/// <para><b>Unflatten</b> — rebuilds the nested object, starting from the
/// original DB payload (when updating) so untouched fields keep their exact
/// types/values. Each edited leaf is coerced to the ORIGINAL leaf's JSON type
/// (number/bool/string) — so editing a normalized column never corrupts the
/// stored type. For brand-new fields/rows there is no original to match, so a
/// value is kept as a string unless it is itself valid JSON (array/object) —
/// this deliberately avoids turning ID-like strings (national IDs, codes) into
/// lossy numbers.</para>
/// </summary>
public static class JsonFlatten
{
    private static readonly JsonSerializerOptions Compact = new() { WriteIndented = false };

    public static IReadOnlyDictionary<string, string?> Flatten(JsonObject payload)
    {
        var result = new Dictionary<string, string?>(StringComparer.Ordinal);
        Walk(payload, prefix: "", result);
        return result;
    }

    private static void Walk(JsonNode? node, string prefix, Dictionary<string, string?> acc)
    {
        switch (node)
        {
            case JsonObject obj:
                if (obj.Count == 0 && prefix.Length > 0) { acc[prefix] = "{}"; break; }
                foreach (var kvp in obj)
                    Walk(kvp.Value, prefix.Length == 0 ? kvp.Key : $"{prefix}.{kvp.Key}", acc);
                break;
            case JsonArray arr:
                acc[prefix] = arr.ToJsonString(Compact); // arrays kept as one JSON cell
                break;
            case JsonValue val:
                acc[prefix] = ScalarToString(val);
                break;
            case null:
                acc[prefix] = "";
                break;
        }
    }

    private static string ScalarToString(JsonValue val)
    {
        if (val.TryGetValue<string>(out var s)) return s;
        if (val.TryGetValue<bool>(out var b)) return b ? "true" : "false";
        if (val.TryGetValue<long>(out var l)) return l.ToString(CultureInfo.InvariantCulture);
        if (val.TryGetValue<double>(out var d)) return d.ToString(CultureInfo.InvariantCulture);
        if (val.TryGetValue<decimal>(out var m)) return m.ToString(CultureInfo.InvariantCulture);
        return val.ToJsonString(Compact).Trim('"');
    }

    /// <summary>
    /// Rebuild a payload object from flattened columns, merging into
    /// <paramref name="original"/> (a clone is taken) so untouched fields and
    /// their types survive. <paramref name="skipKeys"/> are columns that are not
    /// payload fields (id, business_key, tracking columns).
    /// </summary>
    public static JsonObject Unflatten(
        IReadOnlyDictionary<string, string?> columns,
        JsonObject? original,
        IReadOnlySet<string> skipKeys)
    {
        var root = original?.DeepClone().AsObject() ?? new JsonObject();
        foreach (var (key, raw) in columns)
        {
            if (skipKeys.Contains(key)) continue;
            var originalLeaf = ResolvePath(original, key);
            SetPath(root, key, Coerce(raw, originalLeaf));
        }
        return root;
    }

    private static JsonNode? Coerce(string? raw, JsonNode? originalLeaf)
    {
        if (raw is null) return null;

        // Match the original leaf's type when present (update path — type-safe).
        switch (originalLeaf)
        {
            case JsonValue ov when ov.TryGetValue<bool>(out _):
                return bool.TryParse(raw, out var b) ? JsonValue.Create(b) : JsonValue.Create(raw);
            case JsonValue ov2 when ov2.TryGetValue<long>(out _) || ov2.TryGetValue<int>(out _):
                return long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l)
                    ? JsonValue.Create(l) : JsonValue.Create(raw);
            case JsonValue ov3 when ov3.TryGetValue<double>(out _) || ov3.TryGetValue<decimal>(out _):
                return double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var d)
                    ? JsonValue.Create(d) : JsonValue.Create(raw);
            case JsonObject or JsonArray:
                return TryParseJson(raw) ?? JsonValue.Create(raw);
        }

        // New field / row: keep as string unless the cell is itself JSON
        // (array/object). NEVER coerce bare numerics → protects IDs/codes.
        var trimmed = raw.TrimStart();
        if (trimmed.StartsWith('[') || trimmed.StartsWith('{'))
            return TryParseJson(raw) ?? JsonValue.Create(raw);
        return JsonValue.Create(raw);
    }

    private static JsonNode? TryParseJson(string raw)
    {
        try { return JsonNode.Parse(raw); }
        catch (JsonException) { return null; }
    }

    private static JsonNode? ResolvePath(JsonObject? root, string dottedKey)
    {
        JsonNode? node = root;
        foreach (var seg in dottedKey.Split('.'))
        {
            if (node is JsonObject obj && obj.TryGetPropertyValue(seg, out var next)) node = next;
            else return null;
        }
        return node;
    }

    private static void SetPath(JsonObject root, string dottedKey, JsonNode? value)
    {
        var segments = dottedKey.Split('.');
        var cursor = root;
        for (var i = 0; i < segments.Length - 1; i++)
        {
            var seg = segments[i];
            if (cursor[seg] is JsonObject child) cursor = child;
            else { var created = new JsonObject(); cursor[seg] = created; cursor = created; }
        }
        cursor[segments[^1]] = value;
    }
}
